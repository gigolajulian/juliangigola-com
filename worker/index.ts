/* ── juliangigola-booking: the Worker that holds the booking lock ──
 * Deployed on its own (`npx wrangler deploy -c worker/wrangler.jsonc`),
 * never by Workers Builds. The site's Worker reaches the lock through its
 * BOOKING_LOCK binding (`script_name`); nothing is served here.
 * Hourly, `scheduled` mails the day-before reminders (`remind`). Every ten
 * minutes it asks the site to fold hello@'s new Gmail into leads
 * (`app/api/leads/gmail`), so leads, their key and Gmail stay on the site.
 * ─────────────────────────────────────────────────────────────── */

import { lock, type BookingRecord } from "../lib/booking/booking-engine";
import { manageLinks } from "../lib/booking/booking-token";
import { confirmMail, sendConfirm } from "../lib/booking/confirm";

export { BookingLock } from "./booking-lock";

type Env = Parameters<typeof lock>[0] & { CLIENT_EMAIL?: CloudflareEnv["CLIENT_EMAIL"]; BOOKING_SECRET?: string; SITE?: CloudflareEnv["ASSETS"] };

/** Mails every reminder due now, then marks it, so the next hour skips it. Returns how many went out. */
export async function remind(env: Env) {
  const { records } = await lock<{ records: BookingRecord[] }>(env, "due", null);
  for (const r of records) {
    const c = {
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
    } as const;
    const sent = await sendConfirm(env.CLIENT_EMAIL, c);
    await lock(env, "reminded", r.id);
    if (sent) await logSent(env, r.email, confirmMail(c).subject, r.id);
  }
  return records.length;
}

/** Tells the site's lead desk a reminder went out (the lead key lives there). Never throws. */
async function logSent(env: Env, email: string, subject: string, booking: string) {
  if (!env.SITE || !env.BOOKING_SECRET) return;
  const res = await env.SITE.fetch("https://juliangigola.com/api/leads/mail", {
    method: "POST",
    headers: { authorization: `Bearer ${env.BOOKING_SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ email, subject, kind: "reminder", booking }),
  }).catch((e: unknown) => (console.error("lead log", String(e)), null));
  if (res && !res.ok) console.error("lead log", res.status);
}

/** Asks the site to read hello@'s new mail into leads. Logs Google's failure, never throws. */
export async function syncMail(env: Env) {
  if (!env.SITE || !env.BOOKING_SECRET) return;
  const res = await env.SITE.fetch("https://juliangigola.com/api/leads/gmail", { method: "POST", headers: { authorization: `Bearer ${env.BOOKING_SECRET}` } });
  if (!res.ok) console.error("gmail sync", res.status);
}

export const HOURLY = "0 * * * *";

const worker = {
  fetch: () => new Response("Not found.", { status: 404 }),
  scheduled: (event: { cron: string }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) =>
    ctx.waitUntil(event.cron === HOURLY ? remind(env) : syncMail(env)),
};

export default worker;
