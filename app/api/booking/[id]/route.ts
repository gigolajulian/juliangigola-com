import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lockOp, clientView, depositPaid, type ChangeResult } from "@/lib/booking/booking-engine";
import { EARLY_SHARE, PART_SHARE, refundCents, refundShare } from "@/lib/booking/booking-rules";
import { isAdmin } from "@/lib/vouch";
import { manageLinks, tokenOpens } from "@/lib/booking/booking-token";
import { cancelledSubject, confirmOf, sendCancelled, sendConfirm } from "@/lib/booking/confirm";
import { logMail, recordLead } from "@/lib/leads/lead-store";
import { dashboardLink } from "@/lib/booking/deposit";
import { alertAndLog } from "@/lib/hello-mail";
import { stripe } from "@/lib/stripe";
import { whenPT } from "@/lib/inbox";
import { bodyOf, json } from "@/lib/http";

/* ── a client reschedules or cancels (`/booking/<id>`) ────────────
 * POST {t, action: "cancel"} or {t, action: "reschedule", start}. The
 * token from their mail opens it (`lib/booking/booking-token.ts`); the lock does
 * the change (`lib/booking/booking-engine.ts`). A cancel 48 hours or more before
 * the start refunds the deposit through Stripe, 24 hours or more refunds 70%
 * of it, under that it keeps it (`refundShare`). hello@ hears about every change.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const SAY = { missing: [404, "No such booking."], cancelled: [409, "This booking is already cancelled."], past: [409, "This session has started."], taken: [409, "taken"], moves: [403, "This booking has been moved twice already. It can still be cancelled."], late: [403, "It's under 24 hours before your session, so it can no longer be moved."] } as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  const body = (await bodyOf(request)) ?? {};
  // The lead desk's own two: Julian cancels with a full refund, or marks a no-show. Its gate, never the client's token.
  if (body.action === "cancel-mine" || body.action === "no-show") {
    if (!(await isAdmin(request, env.INBOX_KEY))) return json({ error: "Not authorized." }, 401);
    return body.action === "no-show" ? noShow(env, id) : cancelMine(env, id);
  }
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
    await alertAndLog(env, `Rescheduled: ${what}`, [`${r.name} <${r.email}>`, `Moved to ${whenPT(r.start)} by the client. The calendar is updated.`, ...(r.intent && refundShare(r) <= PART_SHARE ? [refundShare(r) ? `A cancel now refunds 70% of the deposit: first booked for ${whenPT(r.firstStart ?? r.start)}, under 48 hours away.` : `The deposit is no longer refundable: first booked for ${whenPT(r.firstStart ?? r.start)}, under 24 hours away.`] : [])], who, { kind: "reschedule", booking: r.id });
    const sent = await sendConfirm(env.CLIENT_EMAIL, confirmOf(r, await manageLinks(env.BOOKING_SECRET, r)));
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
  const pct = Math.round(share * 100);
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
  if (refunded) await recordLead(env, r.email, { event: { at: new Date().toISOString(), kind: "refund", ref, note: share === 1 ? "Deposit, cancelled 48 hours or more ahead" : `${pct}% of the deposit, cancelled ${share === EARLY_SHARE ? "48 hours or more" : "24 to 48 hours"} ahead`, amount: back } });
  const money = !r.intent ? "No deposit." : refunded ? (share === 1 ? `Deposit refunded: $${back}.` : `Refunded $${back} of the $${paid} deposit (${pct}%). $${paid - back} kept.`) : refunded === false ? `The refund FAILED: refund $${back} by hand in Stripe.` : "Under 24 hours: the deposit is kept.";
  await alertAndLog(env, `Cancelled: ${what}`, [`${r.name} <${r.email}>`, "Cancelled by the client. The event is off the calendar.", money, ...(r.intent && key ? [`Stripe: ${dashboardLink(r.intent, key)}`] : [])], who, { kind: "cancelled", booking: r.id });
  const gone = { ...who, session: r.session, start: was.start, end: was.end };
  if (await sendCancelled(env.CLIENT_EMAIL, gone, !r.intent ? "none" : refunded ? (share === 1 ? "refunded" : share === EARLY_SHARE ? "early" : "part") : refunded === false ? "late" : "kept", depositPaid(r), back))
    await logMail(env, r.email, cancelledSubject(gone), { to: "client", kind: "cancelled", booking: r.id });
  return json({ record: clientView(r), refunded: refunded ?? null, back: refunded ? back : 0 });
}

type DeskEnv = Parameters<typeof lockOp>[0] & Parameters<typeof recordLead>[0] & { EMAIL?: CloudflareEnv["EMAIL"]; CLIENT_EMAIL?: CloudflareEnv["CLIENT_EMAIL"]; STRIPE_SECRET_KEY?: string };

/** Julian cancels from the desk (2026-11-16): off the calendar, the whole deposit back whatever the hour
    (it is not the client's doing), the client told, a line on the lead and a mail to hello@. */
async function cancelMine(env: DeskEnv, id: string) {
  let out: ChangeResult;
  try {
    out = await lockOp(env, "cancel", id);
  } catch (e) {
    console.error("desk cancel", String(e));
    return json({ error: "Could not reach the calendar. Try again." }, 502);
  }
  if (!out.ok) return json({ error: SAY[out.reason][1] }, SAY[out.reason][0]);
  const { record: r, was } = out;
  const who = { name: r.name, email: r.email };
  const what = [r.session, whenPT(was.start), r.name].join(", ");
  const key = env.STRIPE_SECRET_KEY;
  const paid = depositPaid(r) ?? 0;
  // The whole charge, with no amount, under the ref Stripe's webhook logs a full refund by.
  let refunded: boolean | undefined;
  if (r.intent && key) refunded = await stripe(key, "/refunds", { payment_intent: r.intent }, `refund-${r.intent}`).then(() => true, () => false);
  const at = new Date().toISOString();
  await recordLead(env, r.email, { event: { at, kind: "cancel", ref: `cancel:${r.id}`, note: [r.session, whenPT(was.start), "by Julian"].join(", ") } });
  if (refunded) await recordLead(env, r.email, { event: { at, kind: "refund", ref: `refund-${r.intent}`, note: "Deposit, cancelled by Julian", amount: paid } });
  const money = !r.intent ? "No deposit." : refunded ? `Deposit refunded in full: $${paid}.` : `The refund FAILED: refund $${paid} by hand in Stripe.`;
  await alertAndLog(env, `Cancelled by you: ${what}`, [`${r.name} <${r.email}>`, "Cancelled from the lead desk. The event is off the calendar and the client is told.", money, ...(r.intent && key ? [`Stripe: ${dashboardLink(r.intent, key)}`] : [])], who, { kind: "cancelled", booking: r.id });
  const gone = { ...who, session: r.session, start: was.start, end: was.end };
  if (await sendCancelled(env.CLIENT_EMAIL, gone, !r.intent ? "mineFree" : refunded ? "mine" : "late", paid, paid))
    await logMail(env, r.email, cancelledSubject(gone), { to: "client", kind: "cancelled", booking: r.id });
  return json({ record: clientView(r), refunded: refunded ?? null, back: refunded ? paid : 0 });
}

/** Julian marks a no-show from the desk (2026-11-16): a line on the lead and a mail to hello@. Nothing is
    refunded and the client is not mailed. Only once the session has started, on a live booking; a second click adds nothing. */
async function noShow(env: DeskEnv, id: string) {
  const r = await lockOp(env, "get", id).then((x) => x.record, () => null);
  if (!r) return json({ error: "No such booking." }, 404);
  if (r.cancelled) return json({ error: "This booking is already cancelled." }, 409);
  if (Date.parse(r.start) > Date.now()) return json({ error: "This session has not started." }, 409);
  const what = [r.session, whenPT(r.start), r.name].join(", ");
  const paid = depositPaid(r);
  await recordLead(env, r.email, { event: { at: new Date().toISOString(), kind: "no-show", ref: `no-show:${r.id}`, note: [r.session, whenPT(r.start)].join(", ") } });
  await alertAndLog(env, `No-show: ${what}`, [`${r.name} <${r.email}>`, "Marked a no-show from the lead desk.", paid ? `The $${paid} deposit is kept.` : "No deposit."], { name: r.name, email: r.email }, { kind: "no-show", booking: r.id });
  return json({ ok: true });
}
