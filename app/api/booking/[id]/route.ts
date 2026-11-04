import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lock, managed, type ChangeResult } from "@/lib/booking-engine";
import { refundable } from "@/lib/booking-rules";
import { manageLinks, tokenOpens } from "@/lib/booking-token";
import { cancelledSubject, confirmMail, sendCancelled, sendConfirm } from "@/lib/confirm";
import { logMail } from "@/lib/leads";
import { dashboardLink, mail, stripe } from "@/lib/deposit";
import { whenPT } from "@/lib/inbox";

/* ── a client reschedules or cancels (`/booking/<id>`) ────────────
 * POST {t, action: "cancel"} or {t, action: "reschedule", start}. The
 * token from their mail opens it (`lib/booking-token.ts`); the lock does
 * the change (`lib/booking-engine.ts`). A cancel 48 hours or more before
 * the start refunds the deposit through Stripe; under that it keeps it
 * (Julian, 2026-11-03). hello@ hears about every change.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

const SAY = { missing: [404, "No such booking."], cancelled: [409, "This booking is already cancelled."], past: [409, "This session has started."], taken: [409, "taken"] } as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { t?: string; action?: string; start?: string };
  if (!(await tokenOpens(env.BOOKING_SECRET, id, body.t))) return json({ error: "This link has expired. Reply to your confirmation email." }, 401);

  let out: ChangeResult;
  try {
    if (body.action === "cancel") out = await lock<ChangeResult>(env, "cancel", id);
    else if (body.action === "reschedule" && typeof body.start === "string") out = await lock<ChangeResult>(env, "reschedule", { id, start: body.start });
    else return json({ error: "Nothing to do." }, 400);
  } catch {
    return json({ error: "Could not reach the calendar. Try again." }, 502);
  }
  if (!out.ok) return json({ error: SAY[out.reason][1] }, SAY[out.reason][0]);

  const { record: r, was } = out;
  const who = { name: r.name, email: r.email };
  const what = [r.session, whenPT(was.start), r.name].join(", ");
  const key = env.STRIPE_SECRET_KEY;

  if (body.action === "reschedule") {
    if (await mail(env.EMAIL, `Rescheduled: ${what}`, [`${r.name} <${r.email}>`, `Moved to ${whenPT(r.start)} by the client. The calendar is updated.`, ...(r.intent && !refundable(r) ? [`The deposit is no longer refundable: first booked for ${whenPT(r.firstStart ?? r.start)}, under 48 hours away.`] : [])], who))
      await logMail(env, r.email, `Rescheduled: ${what}`, { to: "hello@", kind: "reschedule", booking: r.id });
    const confirm = { ...who, session: r.session, call: r.call, start: r.start, end: r.end, where: r.where, uid: r.id, manage: await manageLinks(env.BOOKING_SECRET, r), firstStart: r.firstStart, ...(r.intent ? { deposit: { ref: r.intent, at: r.at } } : {}) };
    if (await sendConfirm(env.CLIENT_EMAIL, confirm)) await logMail(env, r.email, confirmMail(confirm).subject, { to: "client", kind: "reschedule", booking: r.id });
    return json({ record: managed(r) });
  }

  // The rule is read against the time it was booked for, at the moment of the cancel.
  let refunded: boolean | undefined;
  if (r.intent && refundable(was) && key) {
    refunded = await stripe(key, "/refunds", { payment_intent: r.intent }, `refund-${r.intent}`).then(
      () => true,
      () => false,
    );
  }
  const money = !r.intent ? "No deposit." : refunded ? "Deposit refunded." : refunded === false ? "The refund FAILED: refund it by hand in Stripe." : "Under 48 hours: the deposit is kept.";
  if (await mail(env.EMAIL, `Cancelled: ${what}`, [`${r.name} <${r.email}>`, "Cancelled by the client. The event is off the calendar.", money, ...(r.intent && key ? [`Stripe: ${dashboardLink(r.intent, key)}`] : [])], who))
    await logMail(env, r.email, `Cancelled: ${what}`, { to: "hello@", kind: "cancelled", booking: r.id });
  const gone = { ...who, session: r.session, start: was.start, end: was.end };
  if (await sendCancelled(env.CLIENT_EMAIL, gone, !r.intent ? "none" : refunded ? "refunded" : refunded === false ? "late" : "kept"))
    await logMail(env, r.email, cancelledSubject(gone), { to: "client", kind: "cancelled", booking: r.id });
  return json({ record: managed(r), refunded: refunded ?? null });
}
