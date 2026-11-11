import { duration, refundable, TZ } from "@/lib/booking/booking-rules";
import { SIG_DARK, SIG_HTML, SIG_TEXT } from "@/lib/email/email-signature";
/* ── the client's confirmation email ──────────────────────────────
 * Julian (2026-10-16): every booking gets a branded "You're in." mail from
 * the site.
 *
 *   - Paid sessions: sent by `settle` once the lock takes the booking, with
 *     the $100 receipt block.
 *   - Free calls: sent by `/api/book`.
 *
 * Sent through `CLIENT_EMAIL`, the one binding that may mail outside
 * hello@, and only from book@ (an alias of hello@). A failed send is logged, never a
 * failed booking. Look: the mock Julian approved (dark, IBM Plex Mono,
 * one accent, hairlines), table layout because mail clients need it.
 * Julian (2026-11-06): light by default, dark where the mail app supports
 * it (prefers-color-scheme). Gmail ignores the query and stays light.
 * ─────────────────────────────────────────────────────────────── */

import { NAME_INK, NAME_W } from "@/lib/email/email-logo";

const FROM = { name: "Julian Gigola", email: "book@juliangigola.com" };
const REPLY_TO = "hello@juliangigola.com";
const SITE = "https://juliangigola.com";

export type Confirm = {
  name: string;
  email: string;
  /** "Portraits", "Wedding call". */
  session: string;
  /** Free calls read differently from shoots. */
  call?: boolean;
  start: string;
  end?: string;
  where?: string;
  /** The booking's id, shown short in the mail. */
  uid: string;
  deposit?: { ref: string; at: string; card?: string };
  /** The site's own reschedule and cancel links; null: none (no BOOKING_SECRET). */
  manage: { reschedule: string; cancel: string } | null;
  /** The time first booked, when it was moved since: the refund is judged by it. */
  firstStart?: string;
  /** "reminder": the day-before mail from the lock Worker's cron. */
  kind?: "reminder";
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });

/** "Wed, Oct 21, 4:00 to 5:00 PM PDT", Julian's time with no city. */
export function when(start: string, end?: string) {
  const s = new Date(start);
  const day = fmt({ weekday: "short", month: "short", day: "numeric" }).format(s);
  const time = fmt({ hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const e = end ? new Date(end) : null;
  /* ICU folds 1:00 AM PDT to 1:00 AM PST (the night clocks fall back) into
     one "1:00 AM PDT", so a range with no dash is written out both ends. */
  const r = e && +e > +s ? time.formatRange(s, e) : "";
  const range = !e || !r ? time.format(s) : /[–-]/.test(r) ? r.replace(/\s*[–-]\s*/, " to ") : `${time.format(s)} to ${time.format(e)}`;
  return `${day}, ${range}`.replace(/ | /g, " ");
}

const first = (name: string) => name.trim().split(/\s+/)[0] || "there";

export function confirmMail(c: Confirm) {
  const at = when(c.start, c.end);
  const remind = c.kind === "reminder";
  const hour = fmt({ hour: "numeric", minute: "2-digit" }).format(new Date(c.start));
  const head = remind ? (c.call ? "Talk tomorrow." : "See you tomorrow.") : "You're in.";
  const lead = remind
    ? c.call
      ? `${first(c.name)}, your ${c.session.toLowerCase()} is tomorrow at ${hour}.${c.where?.startsWith("http") ? " The Meet link is below." : ""}`
      : `${first(c.name)}, your ${c.session.toLowerCase().replace(/ photos$/, "")} session is tomorrow at ${hour}. Give yourself time to get there.`
    : c.call
    ? `Thanks, ${first(c.name)}. Your ${c.session.toLowerCase()} is booked. I'll call you then.`
    : `Thanks, ${first(c.name)}. Your ${c.session.toLowerCase().replace(/ photos$/, "")} session is booked. I'll call you before the day to go over the concept, rate and schedule.`;
  // The length as the booking card says it: "Sat, Nov 8, 10:00 to 11:00 AM PST, 60 minutes".
  const mins = c.end ? Math.round((+new Date(c.end) - +new Date(c.start)) / 60000) : 0;
  const rows: [string, string][] = [["Session", c.session], ["When", mins > 0 ? `${at}, ${duration(mins)}` : at], ...(c.where ? [["Where", c.where] as [string, string]] : []), ["Booking", c.uid.slice(0, 8)]];
  const paid = c.deposit && {
    rows: [["Paid", fmt({ month: "short", day: "numeric", year: "numeric" }).format(new Date(c.deposit.at))], ...(c.deposit.card ? [["Card", c.deposit.card]] : []), ["Ref", c.deposit.ref.slice(0, 11)]] as [string, string][],
    // The site's own engine refunds by Julian's 48-hour rule (`lib/booking/booking-rules.ts`).
    note: remind
      ? "It is under 48 hours now, so a cancel keeps the deposit. Moving to another date carries it over."
      : c.firstStart && c.firstStart !== c.start
      ? refundable({ intent: "x", start: c.start, firstStart: c.firstStart })
        ? `The balance is due after the shoot. The deposit moved with the new date. It is refunded only if you cancel 48 hours or more before the time you first booked, ${when(c.firstStart)}.`
        : `The balance is due after the shoot. The deposit moved with the new date. It is no longer refundable: the time you first booked, ${when(c.firstStart)}, was under 48 hours away.`
      : "The balance is due after the shoot. The deposit moves with a new date, or is refunded if you cancel 48 hours or more before.",
  };
  const links = c.manage;
  const preheader = `${c.session}, ${fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(c.start)).replace(/ /g, " ")}.${c.deposit ? " Deposit of $100 received." : ""}`;

  const rule = "border-top:1px solid rgba(0,0,0,0.12)";
  const muted = "color:#515354";
  const fg = "color:#141211";
  const accent = "color:#007a7b";
  const label = `font-size:11px;letter-spacing:0.14em;text-transform:uppercase;${accent}`;
  const detail = rows
    .map(([k, v], i) => `<tr><td class="muted${i ? " rule" : ""}" style="${muted};padding:12px 0;width:38%;vertical-align:top${i ? `;${rule}` : ""}">${k}</td><td class="fg${i ? " rule" : ""}" style="${fg};padding:12px 0${i ? `;${rule}` : ""}">${esc(v)}</td></tr>`)
    .join("");
  const receipt = paid
    ? `<tr><td class="rule" style="${rule};padding-top:28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mono" style="font-size:13px;line-height:1.5">
<tr><td colspan="2" class="accent" style="${label};padding-bottom:6px">Deposit paid</td></tr>
<tr><td class="fg" style="${fg};font-size:22px;padding-bottom:10px">$100.00</td><td></td></tr>
${paid.rows.map(([k, v]) => `<tr><td class="muted" style="${muted};padding:3px 0;width:38%">${k}</td><td class="fg" style="${fg};padding:3px 0">${esc(v)}</td></tr>`).join("")}
<tr><td colspan="2" class="muted" style="${muted};padding:14px 0 28px;line-height:1.65">${paid.note}</td></tr>
</table></td></tr>`
    : "";

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>You're booked: ${esc(c.session)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>body{margin:0;padding:0;background:#ebedef}.mono{font-family:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace}.ink-d{display:none}
@media (prefers-color-scheme: dark){body,.page{background:#0b0a09!important}.fg{color:#f1f0ed!important}.muted{color:#92908d!important}.accent{color:#50b7b7!important}.rule{border-color:rgba(255,255,255,0.11)!important}.ink-l{display:none!important}.ink-d{display:block!important}${SIG_DARK}}</style>
</head><body>
<div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" style="background:#ebedef"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px" class="mono">
<tr><td style="padding-bottom:36px"><img class="ink-l" src="cid:name-ink" width="189" height="34" alt="Julian Gigola" style="display:block;border:0"><img class="ink-d" src="cid:name-w" width="189" height="34" alt="Julian Gigola" style="border:0"></td></tr>
<tr><td class="mono accent" style="${label};padding-bottom:10px">${remind ? "Tomorrow" : "Booked"}</td></tr>
<tr><td class="mono fg" style="font-size:22px;line-height:1.3;${fg};padding-bottom:16px">${head}</td></tr>
<tr><td class="mono muted" style="font-size:13px;line-height:1.65;${muted};padding-bottom:32px">${esc(lead)}</td></tr>
<tr><td class="rule" style="${rule}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mono" style="font-size:13px;line-height:1.5">${detail}</table></td></tr>
${receipt}
${links ? `<tr><td class="rule" style="${rule};padding:22px 0 0"><a href="${links.reschedule}" class="mono accent" style="${accent};font-size:13px;text-decoration:none">Reschedule</a><span class="muted" style="${muted};font-size:13px">&nbsp;|&nbsp;</span><a href="${links.cancel}" class="mono accent" style="${accent};font-size:13px;text-decoration:none">Cancel</a></td></tr>` : ""}
<tr><td class="mono muted" style="font-size:12px;line-height:1.65;${muted};padding-top:40px">Questions? Reply to this email.<br>${SIG_HTML}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    head,
    "",
    lead,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(paid ? ["", "Deposit paid: $100.00", ...paid.rows.map(([k, v]) => `${k}: ${v}`), paid.note] : []),
    ...(links ? ["", `Reschedule: ${links.reschedule}`, `Cancel: ${links.cancel}`] : []),
    "",
    "Questions? Reply to this email.",
    SIG_TEXT,
  ].join("\n");

  const logo = (contentId: string, b64: string) => ({ content: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), filename: `${contentId}.png`, type: "image/png", disposition: "inline" as const, contentId });
  return { subject: remind ? `Tomorrow: ${c.session}, ${hour}` : `Booked: ${c.session}, ${at}`, html, text, attachments: [logo("name-w", NAME_W), logo("name-ink", NAME_INK)] };
}

/** The subject it sent, for the lead log; null when the mail did not go out. */
export async function sendConfirm(mailer: CloudflareEnv["CLIENT_EMAIL"] | undefined, c: Confirm): Promise<string | null> {
  if (!mailer || !c.email) return null;
  const head = { to: { email: c.email, name: c.name }, from: FROM, replyTo: REPLY_TO };
  const { attachments, ...mail } = confirmMail(c);
  try {
    await mailer.send({ ...head, ...mail, attachments });
    return mail.subject;
  } catch (e) {
    console.error("confirm mail", String(e));
    // Inline parts refused: the client still gets the mail, with the logo linked as before.
    try {
      await mailer.send({ ...head, ...mail, html: mail.html.replace(/cid:(name-w|name-ink)/g, `${SITE}/email-$1.png`) });
      return mail.subject;
    } catch (e2) {
      console.error("confirm mail, no logo", String(e2));
      return null;
    }
  }
}

/** The cancel note's subject, for the lead desk's log too. */
export const cancelledSubject = (c: { session: string; start: string; end?: string }) => `Cancelled: ${c.session}, ${when(c.start, c.end)}`;

/** The client's note that a booking is cancelled, plain, from book@. A failed send is logged, never a failed cancel. Whether it went out. */
export async function sendCancelled(mailer: CloudflareEnv["CLIENT_EMAIL"] | undefined, c: { name: string; email: string; session: string; start: string; end?: string }, refund: "refunded" | "kept" | "none" | "late"): Promise<boolean> {
  if (!mailer || !c.email) return false;
  const money = {
    refunded: "Your $100 deposit is refunded to your card. Banks take 5 to 10 days to show it.",
    late: "The refund did not go through on its own. I'll send it by hand and email you.",
    kept: "It was under 48 hours before the session as first booked, so the $100 deposit is not refunded.",
    none: "",
  }[refund];
  const text = [`Hi ${first(c.name)},`, "", `Your ${c.session.toLowerCase()} on ${when(c.start, c.end)} is cancelled.`, money, "", `Book another time: ${SITE}/book`, "", "Questions? Reply to this email.", SIG_TEXT].filter((l, i, a) => l || a[i - 1]).join("\n");
  try {
    await mailer.send({ to: { email: c.email, name: c.name }, from: FROM, replyTo: REPLY_TO, subject: cancelledSubject(c), text });
    return true;
  } catch (e) {
    console.error("cancel mail", String(e));
    return false;
  }
}
