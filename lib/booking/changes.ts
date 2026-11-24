import { lockOp, clientView, depositPaid, type BookingEnv, type ChangeResult } from "@/lib/booking/engine";
import { recordLead } from "@/lib/leads/lead-store";
import { cancelBooking } from "@/lib/booking/deposit";
import { alertAndLog } from "@/lib/leads/hello-log";
import { whenPT } from "@/lib/time-zone";
import { json, taken, upstreamError } from "@/lib/http";

/* ── what a booking change answers ────────────────────────────────
 * The refusal for each reason the lock gives, read by the client's route
 * (`app/api/booking/[id]`) and the desk's (`app/api/booking/[id]/desk`),
 * and the desk's own two changes. Each route opens its own gate first.
 * ─────────────────────────────────────────────────────────────── */

const SAY = {
  missing: [404, "No such booking."],
  cancelled: [409, "This booking is already cancelled."],
  past: [409, "This session has started."],
  moves: [403, "This booking has been moved twice already. It can still be cancelled."],
  late: [403, "It's under 24 hours before your session, so it can no longer be moved."],
} as const;

/** The answer to a change the lock refused. */
export const refuseChange = (reason: Exclude<ChangeResult, { ok: true }>["reason"]) =>
  reason === "taken" ? taken() : json({ error: SAY[reason][1] }, SAY[reason][0]);

/** The lead desk's own two: Julian cancels with a full refund, or marks a no-show. */
export type DeskAction = "cancel-mine" | "no-show";
export const isDeskAction = (a: unknown): a is DeskAction => a === "cancel-mine" || a === "no-show";

/** Runs a desk action on booking `id`. Call it only behind the admin gate. */
export const deskAction = (env: BookingEnv, id: string, action: DeskAction) =>
  action === "no-show" ? noShow(env, id) : cancelMine(env, id);

/** Julian cancels from the desk: off the calendar, the whole deposit back whatever the hour
    (it is not the client's doing), the client told, a line on the lead and a mail to hello@. */
async function cancelMine(env: BookingEnv, id: string) {
  let out: ChangeResult;
  try {
    out = await lockOp(env, "cancel", id);
  } catch (e) {
    return upstreamError("desk cancel", e, "Could not reach the calendar. Try again.");
  }
  if (!out.ok) return refuseChange(out.reason);
  const { record: r, was } = out;
  const { refunded, back } = await cancelBooking(env, r, was, "julian");
  return json({ record: clientView(r), refunded: refunded ?? null, back });
}

/** Julian marks a no-show from the desk: a line on the lead and a mail to hello@. Nothing is
    refunded and the client is not mailed. Only once the session has started, on a live booking. A second click finds
    the lead's `no-show:<id>` line already there (`recordLead` answers "same") and sends nothing: `{ok, already}`. */
async function noShow(env: BookingEnv, id: string) {
  const r = await lockOp(env, "get", id).then(
    (x) => x.record,
    () => null,
  );
  if (!r) return json({ error: "No such booking." }, 404);
  if (r.cancelled) return json({ error: "This booking is already cancelled." }, 409);
  if (Date.parse(r.start) > Date.now()) return json({ error: "This session has not started." }, 409);
  const what = [r.session, whenPT(r.start), r.name].join(", ");
  const paid = depositPaid(r);
  const logged = await recordLead(env, r.email, {
    event: { at: new Date().toISOString(), kind: "no-show", ref: `no-show:${r.id}`, note: [r.session, whenPT(r.start)].join(", ") },
  });
  if (logged.status === "same") return json({ ok: true, already: true });
  await alertAndLog(
    env,
    `No-show: ${what}`,
    [`${r.name} <${r.email}>`, "Marked a no-show from the lead desk.", paid ? `The $${paid} deposit is kept.` : "No deposit."],
    { who: { name: r.name, email: r.email }, log: { kind: "no-show", booking: r.id } },
  );
  return json({ ok: true });
}
