/* ── the proof mails ──────────────────────────────────────────────
 * Julian (2026-11-06): light by default, dark where the mail app supports
 * it (prefers-color-scheme; Gmail ignores it and stays light). Same table layout and Plex Mono as the booking mail
 * (`lib/confirm.ts`), from book@ through CLIENT_EMAIL, reply-to hello@.
 * Never sent from Lightroom: only when he hits Send in /admin Leads.
 * ─────────────────────────────────────────────────────────────── */

import { NAME_INK, NAME_W } from "@/lib/email-logo";
import { SIG_DARK, SIG_HTML, SIG_TEXT } from "@/lib/email-signature";
import { extras, type Proof } from "@/lib/proofs";

const FROM = { name: "Julian Gigola", email: "book@juliangigola.com" };
const REPLY_TO = "hello@juliangigola.com";
const SITE = "https://juliangigola.com";
const TZ = "America/Los_Angeles";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const day = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
export const proofUrl = (token: string) => `${SITE}/proof/${token}`;

const C = { bg: "#ebedef", fg: "#141211", mu: "#515354", ac: "#007a7b", rule: "border-top:1px solid rgba(0,0,0,0.12)" };
const label = `font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.ac}`;

type Inline = { content: Uint8Array; filename: string; type: string; disposition: "inline"; contentId: string };
const png = (id: string, b64: string): Inline => ({ content: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), filename: `${id}.png`, type: "image/png", disposition: "inline", contentId: id });
const logos = () => [png("name-ink", NAME_INK), png("name-w", NAME_W)];
const DARK = `@media (prefers-color-scheme: dark){body,.page{background:#0b0a09!important}.fg{color:#f1f0ed!important}.mu{color:#92908d!important}.ac{color:#50b7b7!important}.rule{border-color:rgba(255,255,255,0.11)!important}.cta{background:#f1f0ed!important;color:#0b0a09!important}.ink-l{display:none!important}.ink-d{display:block!important}${SIG_DARK}}`;

function page(title: string, preheader: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>body{margin:0;padding:0;background:${C.bg}}.mono{font-family:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace}.ink-d{display:none}${DARK}</style>
</head><body>
<div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</div>
<table class="page" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px" class="mono">
<tr><td style="padding-bottom:36px"><img class="ink-l" src="cid:name-ink" width="189" height="34" alt="Julian Gigola" style="display:block;border:0"><img class="ink-d" src="cid:name-w" width="189" height="34" alt="Julian Gigola" style="border:0"></td></tr>
${body}
<tr><td class="mono mu" style="font-size:12px;line-height:1.65;color:${C.mu};padding-top:40px">Questions? Reply to this email.<br>${SIG_HTML}</td></tr>
</table></td></tr></table></body></html>`;
}

const rows = (r: [string, string][]) =>
  `<tr><td class="rule" style="${C.rule}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mono" style="font-size:13px;line-height:1.5">${r
    .map(([k, v], i) => `<tr><td class="mu rule" style="color:${C.mu};padding:12px 0;width:38%${i ? `;${C.rule}` : ""}">${k}</td><td class="fg rule" style="color:${C.fg};padding:12px 0${i ? `;${C.rule}` : ""}">${esc(v)}</td></tr>`)
    .join("")}</table></td></tr>`;

/** The "Your proofs are ready" mail. `strip` is up to four frames sent inline. */
export function proofMail(p: Proof, strip: { id: string; bytes: Uint8Array }[]) {
  const url = proofUrl(p.token);
  const closes = p.closesAt ? day(p.closesAt) : "";
  const n = p.frames.length;
  const lead = `Thanks again for the shoot. All ${n} frames are up. Select the ${p.included === 10 ? "ten" : p.included} you want and I'll retouch them.`;
  const terms: [string, string][] = [["Frames", String(n)], ["Included", `${p.included} retouched`], ["Extra frames", `$${p.price} each`], ...(closes ? [["Open until", closes] as [string, string]] : [])];
  const imgs = strip.length
    ? `<tr><td style="padding-bottom:30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${strip
        .map((f) => `<td width="25%" style="padding:0 2px"><img src="cid:f-${f.id}" width="126" alt="" style="display:block;width:100%;height:auto;border:0"></td>`)
        .join("")}</tr></table></td></tr>`
    : "";
  const html = page(
    "Your proofs are ready",
    `${n} frames. Select ${p.included}${closes ? `, open until ${closes}` : ""}.`,
    `<tr><td class="mono ac" style="${label};padding-bottom:10px">Proofs</td></tr>
<tr><td class="mono fg" style="font-size:22px;line-height:1.3;color:${C.fg};padding-bottom:16px">Your proofs are ready.</td></tr>
<tr><td class="mono mu" style="font-size:13px;line-height:1.65;color:${C.mu};padding-bottom:${p.note ? 18 : 30}px">${esc(lead)}</td></tr>
${p.note ? `<tr><td class="mono fg rule" style="font-size:13px;line-height:1.65;color:${C.fg};padding:0 0 30px 14px;border-left:1px solid ${C.ac}">${esc(p.note)}</td></tr>` : ""}
${imgs}
${rows(terms)}
<tr><td style="padding:28px 0 30px"><a href="${url}" class="mono cta" style="display:inline-block;padding:14px 20px;background:${C.fg};color:${C.bg};text-decoration:none;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase">See your proofs</a></td></tr>
<tr><td class="mono mu" style="font-size:13px;line-height:1.9;color:${C.mu}">1. Tap a frame to select it. Your selects collect in Selects.<br>2. Hit Send selects. Extras are paid on the way out.<br>3. I retouch your selects and email you the finals.</td></tr>`,
  );
  const text = ["Your proofs are ready.", "", lead, ...(p.note ? ["", p.note] : []), "", ...terms.map(([k, v]) => `${k}: ${v}`), "", `See your proofs: ${url}`, "", "Questions? Reply to this email.", SIG_TEXT].join("\n");
  const attachments: Inline[] = [...logos(), ...strip.map((f) => ({ content: f.bytes, filename: `${f.id}.jpg`, type: "image/jpeg", disposition: "inline" as const, contentId: `f-${f.id}` }))];
  return { subject: "Your proofs are ready", html, text, attachments };
}

const fileList = (p: Proof) => p.selects.map((id) => {
  const f = p.frames.find((x) => x.id === id);
  return `${f?.file ?? id}${p.notes[id] ? ` · ${p.notes[id]}` : ""}`;
});

/** The receipt the client gets when they send. */
export function receiptMail(p: Proof) {
  const x = extras(p.selects.length, p.included, p.price);
  const files = fileList(p);
  const paid = p.paid ? `$${(p.paid.amount / 100).toFixed(2)}` : "$0.00";
  const summary: [string, string][] = [["Selected", String(p.selects.length)], ["Included", String(p.included)], ["Extra", String(x.n)], ["Paid", paid]];
  const lead = `I have your ${p.selects.length} ${p.selects.length === 1 ? "frame" : "frames"}${Object.keys(p.notes).length ? " and your notes" : ""}. I'll email you when the finals are ready.`;
  const html = page(
    "Selects are in",
    `${p.selects.length} selected.${p.paid ? ` Paid ${paid}.` : ""}`,
    `<tr><td class="mono ac" style="${label};padding-bottom:10px">Sent</td></tr>
<tr><td class="mono fg" style="font-size:22px;line-height:1.3;color:${C.fg};padding-bottom:16px">Selects are in.</td></tr>
<tr><td class="mono mu" style="font-size:13px;line-height:1.65;color:${C.mu};padding-bottom:30px">${esc(lead)}</td></tr>
${rows(summary)}
<tr><td class="mono fg rule" style="${C.rule};font-size:12px;line-height:1.9;color:${C.fg};padding-top:18px">${files.map(esc).join("<br>")}</td></tr>`,
  );
  const text = ["Selects are in.", "", lead, "", summary.map(([k, v]) => `${k}: ${v}`).join(" · "), "", ...files, "", "Questions? Reply to this email.", SIG_TEXT].join("\n");
  return { subject: "Selects are in", html, text, attachments: logos() };
}

/** Julian's alert to hello@: plain lines for `mail()` in lib/deposit. */
export function alertLines(p: Proof): { subject: string; lines: string[] } {
  const paid = p.paid ? `, $${(p.paid.amount / 100).toFixed(0)} paid${p.paid.pending ? " by bank, clearing in about 4 business days" : ""}` : "";
  return {
    subject: `Selects in: ${p.name} (${p.selects.length}${paid})`,
    lines: [
      `${p.submittedBy ?? p.email ?? "The client"} sent ${p.selects.length} selects for ${p.name}${paid}.`,
      ...(p.balance ? [`Shoot balance: $${p.balance}.`] : []),
      `${Math.min(p.selects.length, p.included)} included${p.selects.length > p.included ? ` · ${p.selects.length - p.included} extra × $${p.price} = $${(p.selects.length - p.included) * p.price}` : ""}.`,
      ...(p.message ? ["", `Message: ${p.message}`] : []),
      "",
      ...fileList(p),
      "",
      "Hit Publish on the gallery in Lightroom to pull them in.",
    ],
  };
}

export async function sendClient(mailer: CloudflareEnv["CLIENT_EMAIL"] | undefined, to: string, m: { subject: string; html: string; text: string; attachments: Inline[] }): Promise<boolean> {
  if (!mailer) return false;
  const head = { to: { email: to }, from: FROM, replyTo: REPLY_TO };
  try {
    await mailer.send({ ...head, ...m });
    return true;
  } catch (e) {
    console.error("proof mail", m.subject, String(e));
    // Inline parts refused: send without the frames, the logo linked.
    try {
      await mailer.send({ ...head, subject: m.subject, text: m.text, html: m.html.replace(/<tr><td style="padding-bottom:30px"><table[\s\S]*?<\/table><\/td><\/tr>/, "").replace("cid:name-ink", `${SITE}/email-name-ink.png`).replace("cid:name-w", `${SITE}/email-name-w.png`) });
      return true;
    } catch (e2) {
      console.error("proof mail, plain", String(e2));
      return false;
    }
  }
}
