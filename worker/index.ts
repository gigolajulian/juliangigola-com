/* ── juliangigola-booking: the Worker that holds the booking lock ──
 * Deployed on its own (`npx wrangler deploy -c worker/wrangler.jsonc`),
 * never by Workers Builds. The site's Worker reaches the lock through its
 * BOOKING_LOCK binding (`script_name`); nothing is served here.
 * Hourly, `scheduled` mails the day-before reminders (`remind`).
 * ─────────────────────────────────────────────────────────────── */

import { lock, type BookingRecord } from "../lib/booking-engine";
import { manageLinks } from "../lib/booking-token";
import { sendConfirm } from "../lib/confirm";

export { BookingLock } from "./booking-lock";

type Env = Parameters<typeof lock>[0] & { CLIENT_EMAIL?: CloudflareEnv["CLIENT_EMAIL"]; BOOKING_SECRET?: string };

/** Mails every reminder due now, then marks it, so the next hour skips it. Returns how many went out. */
export async function remind(env: Env) {
  const { records } = await lock<{ records: BookingRecord[] }>(env, "due", null);
  for (const r of records) {
    await sendConfirm(env.CLIENT_EMAIL, {
      kind: "reminder",
      name: r.name,
      email: r.email,
      session: r.session,
      call: r.call,
      start: r.start,
      end: r.end,
      where: r.where,
      uid: r.id,
      manage: await manageLinks(env.BOOKING_SECRET, r),
      ...(r.intent ? { deposit: { ref: r.intent, at: r.at } } : {}),
    });
    await lock(env, "reminded", r.id);
  }
  return records.length;
}

const worker = {
  fetch: () => new Response("Not found.", { status: 404 }),
  scheduled: (_: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) => ctx.waitUntil(remind(env)),
};

export default worker;
