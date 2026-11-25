/* ── juliangigola-booking: the Worker that holds the booking lock ──
 * Deployed on its own (`npx wrangler deploy -c worker/wrangler.jsonc`),
 * never by Workers Builds. The site's Worker reaches the lock through its
 * BOOKING_LOCK binding (`script_name`); nothing is served here.
 * Hourly, `scheduled` mails the day-before reminders (`remind`). Every ten
 * minutes it asks the site to fold hello@'s new Gmail into leads
 * (`app/api/leads/gmail`), so leads, their key and Gmail stay on the site,
 * then to copy the desk to the Google Sheet (`app/api/leads/sheet`).
 * Mondays at 16:00 and 17:00 UTC, whichever is 9 AM Pacific asks the site
 * to mail hello@ the week (`app/api/leads/weekly`). Hourly too, the 9 AM
 * Pacific run asks for the galleries' daily summary (`app/api/proof/daily`),
 * and `health` loads the site's main pages, mailing hello@ from book@ when one
 * fails. It goes through SITE, so it proves the site's Worker answers, not DNS.
 * ─────────────────────────────────────────────────────────────── */

import { lockOp, type BookingEnv } from "../lib/booking/engine";
import { manageLinks } from "../lib/booking/manage-link";
import { confirmOf, sendConfirm } from "../lib/booking/confirm";
import { TZ } from "../lib/time-zone";

export { BookingLock } from "./booking-lock";

type Env = Pick<BookingEnv, "BOOKING_LOCK" | "CLIENT_EMAIL" | "BOOKING_SECRET"> & { WORKER_KEY?: string; SITE?: CloudflareEnv["ASSETS"] };

/** Mails every reminder and heads-up due now, then marks it, so the next hour skips it. A failed send is marked too, so a
    flaky binding never mails anyone twice. Returns how many went out. */
export async function remind(env: Env) {
  return (await mailDue(env, "due", "reminded", "reminder")) + (await mailDue(env, "dueHeads", "headed", "headsup"));
}

async function mailDue(env: Env, due: "due" | "dueHeads", mark: "reminded" | "headed", kind: "reminder" | "headsup") {
  const { records } = await lockOp(env, due, null);
  let out = 0;
  for (const r of records) {
    const sent = await sendConfirm(env.CLIENT_EMAIL, { kind, ...confirmOf(r, await manageLinks(env.BOOKING_SECRET, r)) });
    await lockOp(env, mark, r.id);
    if (!sent) continue;
    out++;
    await logSent(env, r.email, sent, r.id, kind);
  }
  return out;
}

/** POSTs to the site's `path` with the Worker's key, a JSON `body` when given. Logs a failure under `label`, never throws. */
async function askSite(env: Env, path: string, label: string, body?: unknown) {
  if (!env.SITE || !env.WORKER_KEY) return;
  const json = body === undefined ? {} : { "content-type": "application/json" };
  const res = await env.SITE.fetch(`https://juliangigola.com${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.WORKER_KEY}`, ...json },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }).catch((e: unknown) => (console.error(label, String(e)), null));
  if (res && !res.ok) console.error(label, res.status);
}

/** Whether it is the 9 o'clock hour in Pacific time: the cron fires at both UTC hours DST can put it on. */
export const isNineAmPacific = (now: Date) =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now)) === 9;

/** Tells the site's lead desk a reminder went out (the lead key lives there). Never throws. */
const logSent = (env: Env, email: string, subject: string, booking: string, kind: string) =>
  askSite(env, "/api/leads/mail", "lead log", { email, subject, kind, booking });

/** Asks the site to read hello@'s new mail into leads. Logs Google's failure, never throws. */
export const syncMail = (env: Env) => askSite(env, "/api/leads/gmail", "gmail sync");

/** Asks the site to copy the lead desk to the Sheet; it skips when nothing changed. Never throws. */
export const copySheet = (env: Env) => askSite(env, "/api/leads/sheet", "sheet sync");

/** Asks the site to mail hello@ the week, at 9 AM Pacific only. Never throws. */
export async function weekly(env: Env, now = new Date()) {
  if (isNineAmPacific(now)) await askSite(env, "/api/leads/weekly", "weekly mail");
}

/** Asks the site for the galleries' daily summary, at 9 AM Pacific only. Never throws, so the reminders beside it always run. */
export async function daily(env: Env, now = new Date()) {
  if (isNineAmPacific(now)) await askSite(env, "/api/proof/daily", "gallery summary");
}

/** Pages the hourly check loads: the home page, booking and the work. */
export const HEALTH_PATHS = ["/", "/book", "/portfolio"];

/** Loads each page through SITE; a throw, a 5xx or a 4xx mails hello@ from book@ (at most hourly while it lasts). Never throws. */
export async function health(env: Env) {
  if (!env.SITE) return [];
  const bad: string[] = [];
  for (const path of HEALTH_PATHS) {
    const res = await env.SITE.fetch(`https://juliangigola.com${path}`, { redirect: "manual" }).catch((e: unknown) => String(e));
    if (typeof res === "string") bad.push(`${path}: ${res.slice(0, 200)}`);
    else if (res.status >= 400) bad.push(`${path}: ${res.status}`);
  }
  if (bad.length && env.CLIENT_EMAIL)
    await env.CLIENT_EMAIL.send({
      to: "hello@juliangigola.com",
      from: { name: "Julian Gigola website", email: "book@juliangigola.com" },
      subject: `Site check failed: ${bad.length} of ${HEALTH_PATHS.length} pages`,
      text: [...bad, "", "Checked by the booking Worker's hourly run. Logs: npx wrangler tail juliangigola"].join("\n"),
    }).catch((e: unknown) => console.error("health mail", String(e)));
  return bad;
}

export const HOURLY = "0 * * * *";
export const WEEKLY = "0 16,17 * * 1";

const worker = {
  fetch: () => new Response("Not found.", { status: 404 }),
  scheduled: (event: { cron: string }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) =>
    ctx.waitUntil(
      event.cron === HOURLY
        ? Promise.all([remind(env), daily(env), health(env)])
        : event.cron === WEEKLY
          ? weekly(env)
          : syncMail(env).then(() => copySheet(env)),
    ),
};

export default worker;
