import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lockOp, clientView, depositPaid, type ChangeResult } from "@/lib/booking/booking-engine";
import { refundCents, refundShare } from "@/lib/booking/booking-rules";
import { manageLinks, tokenOpens } from "@/lib/booking/booking-token";
import { cancelledSubject, sendCancelled, sendConfirm } from "@/lib/booking/confirm";
import { logMail, recordLead } from "@/lib/leads/lead-store";
import { dashboardLink } from "@/lib/booking/deposit";
import { alertHello } from "@/lib/hello-mail";
import { stripe } from "@/lib/stripe";
import { whenPT } from "@/lib/inbox";
import { bodyOf, json } from "@/lib/http";

/* ── a client reschedules or cancels (`/booking/<id>`) ────────────
 * POST {t, action: "cancel"} or {t, action: "reschedule", start}. The
 * token from their mail opens it (`lib/booking/booking-token.ts`); the lock does
 * the change (`lib/booking/booking-engine.ts`). A cancel 48 hours or more before
 * the start refunds the deposit through Stripe, 24 hours or more refunds 70%
 * of it, under that it keeps it (`refundShare`, Julian, 2026-11-16). hello@ hears about every change.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const SAY = { missing: [404, "No such booking."], cancelled: [409, "This booking is already cancelled."], past: [409, "This session has started."], taken: [409, "taken"] } as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  const body = (await bodyOf(request)) ?? {};
  if (!(await tokenOpens(env.BOOKING_SECRET, id, typeof body.t === "string" ? body.t : undefined))) return json({ error: "This link has expired. Reply to your confirmation email." }, 401);

  let out: ChangeResult;
  try {
    if (body.action === "cancel") out = await lockOp(env, "cancel", id);
    else if (body.action === "reschedule" && typeof body.start === "string") out = await lockOp(env, "reschedule", { id, start: body.start });
    else return json({ error: "Nothing to do." }, 400);
  } catch (e) {
    console.error("booking change", String(e));
    return json({ error: "Could not reach the calendar. Try again." }, 502);
  }
  if (!out.ok) return json({ error: SAY[out.reason][1] }, SAY[out.reason][0]);

  const { record: r, was } = out;
  const who = { name: r.name, email: r.email };
  const what = [r.session, whenPT(was.start), r.name].join(", ");
  const key = env.STRIPE_SECRET_KEY;

  if (body.action === "reschedule") {
    await recordLead(env, r.email, { event: { at: new Date().toISOString(), kind: "reschedule", ref: `${r.id}:${r.start}`, note: whenPT(r.start) }, when: r.start });
    if (await alertHello(env.EMAIL, `Rescheduled: ${what}`, [`${r.name} <${r.email}>`, `Moved to ${whenPT(r.start)} by the client. The calendar is updated.`, ...(r.intent && refundShare(r) < 1 ? [refundShare(r) ? `A cancel now refunds 70% of the deposit: first booked for ${whenPT(r.firstStart ?? r.start)}, under 48 hours away.` : `The deposit is no longer refundable: first booked for ${whenPT(r.firstStart ?? r.start)}, under 24 hours away.`] : [])], who))
      await logMail(env, r.email, `Rescheduled: ${what}`, { to: "hello@", kind: "reschedule", booking: r.id });
    const confirm = { ...who, session: r.session, call: r.call, start: r.start, end: r.end, where: r.where, uid: r.id, manage: await manageLinks(env.BOOKING_SECRET, r), firstStart: r.firstStart, ...(r.intent ? { deposit: { ref: r.intent, at: r.at, amount: depositPaid(r) } } : {}) };
    const sent = await sendConfirm(env.CLIENT_EMAIL, confirm);
    if (sent) await logMail(env, r.email, sent, { to: "client", kind: "reschedule", booking: r.id });
    return json({ record: clientView(r) });
  }

  // The rule is read against the time it was booked for, at the moment of the cancel.
  // A whole refund is sent as before, with no amount; a part one names its cents and shares the ref
  // Stripe's webhook logs it under (`refund-<intent>-<cents so far>`), so the log never counts it twice.
  const share = r.intent ? refundShare(was) : 0;
  const paid = depositPaid(r) ?? 0;
  const cents = refundCents(paid, share);
  const back = cents / 100;
  const ref = share === 1 ? `refund-${r.intent}` : `refund-${r.intent}-${cents}`;
  let refunded: boolean | undefined;
  if (r.intent && share && key) {
    refunded = await stripe(key, "/refunds", { payment_intent: r.intent, ...(share === 1 ? {} : { amount: String(cents) }) }, ref).then(
      () => true,
      () => false,
    );
  }
  await recordLead(env, r.email, { event: { at: new Date().toISOString(), kind: "cancel", ref: `cancel:${r.id}`, note: [r.session, whenPT(was.start)].join(", ") } });
  // What went back, off this booking's record, so the log says what Stripe did.
  if (refunded) await recordLead(env, r.email, { event: { at: new Date().toISOString(), kind: "refund", ref, note: share === 1 ? "Deposit, cancelled 48 hours or more ahead" : "70% of the deposit, cancelled 24 to 48 hours ahead", amount: back } });
  const money = !r.intent ? "No deposit." : refunded ? (share === 1 ? `Deposit refunded: $${back}.` : `Refunded $${back} of the $${paid} deposit (70%). $${paid - back} kept.`) : refunded === false ? `The refund FAILED: refund $${back} by hand in Stripe.` : "Under 24 hours: the deposit is kept.";
  if (await alertHello(env.EMAIL, `Cancelled: ${what}`, [`${r.name} <${r.email}>`, "Cancelled by the client. The event is off the calendar.", money, ...(r.intent && key ? [`Stripe: ${dashboardLink(r.intent, key)}`] : [])], who))
    await logMail(env, r.email, `Cancelled: ${what}`, { to: "hello@", kind: "cancelled", booking: r.id });
  const gone = { ...who, session: r.session, start: was.start, end: was.end };
  if (await sendCancelled(env.CLIENT_EMAIL, gone, !r.intent ? "none" : refunded ? (share === 1 ? "refunded" : "part") : refunded === false ? "late" : "kept", depositPaid(r), back))
    await logMail(env, r.email, cancelledSubject(gone), { to: "client", kind: "cancelled", booking: r.id });
  return json({ record: clientView(r), refunded: refunded ?? null, back: refunded ? back : 0 });
}
