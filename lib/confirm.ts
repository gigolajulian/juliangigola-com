/* ── the client's confirmation email ──────────────────────────────
 * Julian (2026-10-16): every booking gets a branded "You're in." mail from
 * the site, on top of Cal.com's stock one (Cal stays on the free plan).
 *
 *   - Paid sessions: sent by `settle` once Cal.com takes the booking, with
 *     the $100 receipt block.
 *   - Free calls: sent by Cal.com's webhook (`/api/cal`). Paid sessions are
 *     skipped there, so a site booking mails once and a cal.com booking
 *     without a deposit gets nothing that says it is confirmed.
 *
 * Sent through `CLIENT_EMAIL`, the one binding that may mail outside
 * hello@, and only from book@ (an alias of hello@). A failed send is logged, never a
 * failed booking. Look: the mock Julian approved (dark, IBM Plex Mono,
 * one accent, hairlines), table layout because mail clients need it.
 * ─────────────────────────────────────────────────────────────── */

const FROM = { name: "Julian Gigola", email: "book@juliangigola.com" };
const REPLY_TO = "hello@juliangigola.com";
const SITE = "https://juliangigola.com";
const TZ = "America/Los_Angeles";

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
  /** Cal.com's booking uid, for the reschedule and cancel links. */
  uid: string;
  deposit?: { ref: string; at: string; card?: string };
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });

/** "Wed, Oct 21, 4:00 to 5:00 PM PDT", Julian's time with no city. */
export function when(start: string, end?: string) {
  const s = new Date(start);
  const day = fmt({ weekday: "short", month: "short", day: "numeric" }).format(s);
  const time = fmt({ hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const e = end ? new Date(end) : null;
  const range = e && +e > +s ? time.formatRange(s, e).replace(/\s*[–-]\s*/, " to ") : time.format(s);
  return `${day}, ${range}`.replace(/ | /g, " ");
}

const first = (name: string) => name.trim().split(/\s+/)[0] || "there";

export function confirmMail(c: Confirm) {
  const at = when(c.start, c.end);
  const lead = c.call
    ? `Thanks, ${first(c.name)}. Your ${c.session.toLowerCase()} is booked. I'll call you then.`
    : `Thanks, ${first(c.name)}. Your ${c.session.toLowerCase().replace(/ photos$/, "")} session is booked. I'll call you before the day to go over the concept, rate and schedule.`;
  const rows: [string, string][] = [["Session", c.session], ["When", at], ...(c.where ? [["Where", c.where] as [string, string]] : []), ["Booking", c.uid.slice(0, 8)]];
  const paid = c.deposit && {
    rows: [["Paid", fmt({ month: "short", day: "numeric", year: "numeric" }).format(new Date(c.deposit.at))], ...(c.deposit.card ? [["Card", c.deposit.card]] : []), ["Ref", c.deposit.ref.slice(0, 11)]] as [string, string][],
    note: "The balance is due after the shoot. The deposit moves with a new date, or is refunded up to 2 business days before.",
  };
  const reschedule = `https://cal.com/reschedule/${encodeURIComponent(c.uid)}`;
  const cancel = `https://cal.com/booking/${encodeURIComponent(c.uid)}?cancel=true`;
  const preheader = `${c.session}, ${fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(c.start)).replace(/ /g, " ")}.${c.deposit ? " Deposit of $100 received." : ""}`;

  const rule = "border-top:1px solid rgba(255,255,255,0.11)";
  const muted = "color:#92908d";
  const fg = "color:#f1f0ed";
  const accent = "color:#50b7b7";
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

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light">
<title>You're booked: ${esc(c.session)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>body{margin:0;padding:0;background:#0b0a09}.mono{font-family:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace}.ink-l{display:none}
@media (prefers-color-scheme: light){body,.page{background:#ebedef!important}.fg{color:#141211!important}.muted{color:#515354!important}.accent{color:#007a7b!important}.rule{border-color:rgba(0,0,0,0.12)!important}.ink-d{display:none!important}.ink-l{display:block!important}}</style>
</head><body>
<div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div>
<table role="presentation" class="page" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0a09"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px" class="mono">
<tr><td style="padding-bottom:36px"><img class="ink-d" src="${SITE}/email-name-w.png" width="189" height="34" alt="Julian Gigola" style="display:block;border:0"><img class="ink-l" src="${SITE}/email-name-ink.png" width="189" height="34" alt="Julian Gigola" style="border:0"></td></tr>
<tr><td class="mono accent" style="${label};padding-bottom:10px">Booked</td></tr>
<tr><td class="mono fg" style="font-size:22px;line-height:1.3;${fg};padding-bottom:16px">You're in.</td></tr>
<tr><td class="mono muted" style="font-size:13px;line-height:1.65;${muted};padding-bottom:32px">${esc(lead)}</td></tr>
<tr><td class="rule" style="${rule}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mono" style="font-size:13px;line-height:1.5">${detail}</table></td></tr>
${receipt}
<tr><td class="rule" style="${rule};padding:22px 0 0"><a href="${reschedule}" class="mono accent" style="${accent};font-size:13px;text-decoration:none">Reschedule</a><span class="muted" style="${muted};font-size:13px">&nbsp;|&nbsp;</span><a href="${cancel}" class="mono accent" style="${accent};font-size:13px;text-decoration:none">Cancel</a></td></tr>
<tr><td class="mono muted" style="font-size:12px;line-height:1.65;${muted};padding-top:40px">Questions? Reply to this email.<br><a href="${SITE}" class="muted" style="${muted};text-decoration:none">juliangigola.com</a></td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    "You're in.",
    "",
    lead,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(paid ? ["", "Deposit paid: $100.00", ...paid.rows.map(([k, v]) => `${k}: ${v}`), paid.note] : []),
    "",
    `Reschedule: ${reschedule}`,
    `Cancel: ${cancel}`,
    "",
    "Questions? Reply to this email.",
    SITE,
  ].join("\n");

  return { subject: `Booked: ${c.session}, ${at}`, html, text };
}

export async function sendConfirm(mailer: CloudflareEnv["CLIENT_EMAIL"] | undefined, c: Confirm) {
  if (!mailer || !c.email) return;
  try {
    await mailer.send({ to: { email: c.email, name: c.name }, from: FROM, replyTo: REPLY_TO, ...confirmMail(c) });
  } catch (e) {
    console.error("confirm mail", String(e));
  }
}
