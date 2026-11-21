/* ── the proof mails ──────────────────────────────────────────────
 * Light by default, dark where the mail app supports
 * it (prefers-color-scheme; Gmail ignores it and stays light). Same table layout and Plex Mono as the booking mail
 * (`lib/booking/confirm.ts`), from book@ through CLIENT_EMAIL, reply-to hello@.
 * Never sent from Lightroom: only when he hits Send in /admin Leads.
 * ─────────────────────────────────────────────────────────────── */

import { TZ } from "@/lib/booking/booking-rules";
import { NAME_INK, NAME_W } from "@/lib/email/email-logo";
import { SIG_DARK, SIG_HTML, SIG_TEXT } from "@/lib/email/email-signature";
import { extras, isTestEmail, publicId, shotOrder, type Proof, type ViewerEvent } from "@/lib/proofs/proof";
import { byCodeUnit } from "@/lib/utils";

const FROM = { name: "Julian Gigola", email: "book@juliangigola.com" };
const REPLY_TO = "hello@juliangigola.com";
const SITE = "https://juliangigola.com";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const longDay = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "long", day: "numeric" }).format(new Date(iso));
const day = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
export const proofUrl = (token: string) => `${SITE}/proof/${token}`;

const C = { bg: "#ebedef", fg: "#141211", mu: "#515354", ac: "#007a7b", rule: "border-top:1px solid rgba(0,0,0,0.12)" };
const label = `font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${C.ac}`;

type Inline = { content: Uint8Array; filename: string; type: string; disposition: "inline"; contentId: string };
/** A file the client keeps, like the signed contract. */
type Attached = { content: Uint8Array; filename: string; type: string; disposition: "attachment" };
const png = (id: string, b64: string): Inline => ({ content: Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), filename: `${id}.png`, type: "image/png", disposition: "inline", contentId: id });
const logos = () => [png("name-ink", NAME_INK), png("name-w", NAME_W)];
const DARK = `@media (prefers-color-scheme: dark){body,.page{background:#0b0a09!important}.fg{color:#f1f0ed!important}.mu{color:#92908d!important}.ac{color:#50b7b7!important}.rule{border-color:rgba(255,255,255,0.11)!important}.cta{background:#f1f0ed!important;color:#0b0a09!important}.ink-l{display:none!important}.ink-d{display:block!important}${SIG_DARK}}`;

// Spacers after the preheader, so inbox previews stop there instead of running into the body text.
const PAD = "&#847;&zwnj;&nbsp;".repeat(80);

function page(title: string, preheader: string, body: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>body{margin:0;padding:0;background:${C.bg}}.mono{font-family:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace}.ink-d{display:none}${DARK}</style>
</head><body>
<div style="display:none;max-height:0;overflow:hidden">${esc(preheader)}${PAD}</div>
<table class="page" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px" class="mono">
<tr><td style="padding-bottom:36px"><img class="ink-l" src="cid:name-ink" width="189" height="34" alt="Julian Gigola" style="display:block;border:0"><img class="ink-d" src="cid:name-w" width="189" height="34" alt="Julian Gigola" style="border:0"></td></tr>
${body}
<tr><td class="mono mu" style="font-size:12px;line-height:1.65;color:${C.mu};padding-top:40px">Questions? Reply to this email.<br>${SIG_HTML}</td></tr>
</table></td></tr></table></body></html>`;
}

const rows = (r: [string, string][]) =>
  `<tr><td class="rule" style="${C.rule}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mono" style="font-size:13px;line-height:1.5">${r
    .map(([k, v], i) => `<tr><td class="mu rule" style="color:${C.mu};padding:12px 16px 12px 0;width:38%;white-space:nowrap${i ? `;${C.rule}` : ""}">${k}</td><td class="fg rule" style="color:${C.fg};padding:12px 0;overflow-wrap:anywhere;word-break:break-word${i ? `;${C.rule}` : ""}">${esc(v)}</td></tr>`)
    .join("")}</table></td></tr>`;

/** The "Your proofs are ready" mail. `strip` is up to four frames sent inline. */
export function proofMail(p: Proof, strip: { id: string; bytes: Uint8Array }[]) {
  const url = proofUrl(publicId(p));
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
<tr><td style="padding:28px 0 30px"><a href="${url}" class="mono cta" style="display:inline-block;padding:14px 20px;background:${C.fg};color:${C.bg};text-decoration:none;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase">Open proofs</a></td></tr>
<tr><td class="mono mu" style="font-size:13px;line-height:1.9;color:${C.mu}">1. Tap the ring on a frame to select it. Tap the photo to see it large.<br>2. Hit Send selects. Extras are paid on the way out.<br>3. I retouch your selects and email you the finals.</td></tr>`,
  );
  const text = ["Your proofs are ready.", "", lead, ...(p.note ? ["", p.note] : []), "", ...terms.map(([k, v]) => `${k}: ${v}`), "", `Open proofs: ${url}`, "", "Questions? Reply to this email.", SIG_TEXT].join("\n");
  const attachments: Inline[] = [...logos(), ...strip.map((f) => ({ content: f.bytes, filename: `${f.id}.jpg`, type: "image/jpeg", disposition: "inline" as const, contentId: `f-${f.id}` }))];
  return { subject: "Your proofs are ready", html, text, attachments };
}

export const deliveryUrl = (id: string) => `${SITE}/delivery/${id}`;

/** The "Your photos are ready" mail at Send finals. No photos inline: the finals are the client's to open. */
export function deliveryMail(p: Proof) {
  const url = deliveryUrl(publicId(p));
  const n = p.finals?.length ?? 0;
  const closes = p.closesAt ? day(p.closesAt) : "";
  const lead = `Thanks again for the shoot. Your ${n} finished ${n === 1 ? "photo is" : "photos are"} ready, full size. Save them one by one or all at once.`;
  const terms: [string, string][] = [["Photos", String(n)], ["Format", "JPEG, full size"], ...(closes ? [["Open until", closes] as [string, string]] : [])];
  const html = page(
    "Your photos are ready",
    `Your photos at full resolution.${p.closesAt ? ` Save them by ${longDay(p.closesAt)}.` : ""}`,
    `<tr><td class="mono ac" style="${label};padding-bottom:10px">Finals</td></tr>
<tr><td class="mono fg" style="font-size:22px;line-height:1.3;color:${C.fg};padding-bottom:16px">Your photos are ready.</td></tr>
<tr><td class="mono mu" style="font-size:13px;line-height:1.65;color:${C.mu};padding-bottom:${p.note ? 18 : 30}px">${esc(lead)}</td></tr>
${p.note ? `<tr><td class="mono fg rule" style="font-size:13px;line-height:1.65;color:${C.fg};padding:0 0 30px 14px;border-left:1px solid ${C.ac}">${esc(p.note)}</td></tr>` : ""}
${rows(terms)}
<tr><td style="padding:28px 0 30px"><a href="${url}" class="mono cta" style="display:inline-block;padding:14px 20px;background:${C.fg};color:${C.bg};text-decoration:none;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase">See your photos</a></td></tr>
<tr><td class="mono mu" style="font-size:13px;line-height:1.9;color:${C.mu}">Save a copy somewhere safe. The link closes${closes ? ` on ${closes}` : ""}.</td></tr>`,
  );
  const text = ["Your photos are ready.", "", lead, ...(p.note ? ["", p.note] : []), "", ...terms.map(([k, v]) => `${k}: ${v}`), "", `See your photos: ${url}`, "", "Questions? Reply to this email.", SIG_TEXT].join("\n");
  return { subject: "Your photos are ready", html, text, attachments: logos() };
}

const shortDay = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" }).format(new Date(iso));

/** The one reminder: plain, no sales voice. Proofs count the client's own picks so far; finals only say when. */
export function reminderMail(p: Proof, stage: "proofs" | "finals") {
  const finals = stage === "finals";
  const url = (finals ? deliveryUrl : proofUrl)(publicId(p));
  const by = p.closesAt ? longDay(p.closesAt) : "";
  const subject = `Your ${finals ? "photos" : "proofs"} close${p.closesAt ? ` ${shortDay(p.closesAt)}` : " soon"}`;
  const picked = (p.email && p.viewers?.[p.email.trim().toLowerCase()]?.picks.length) || 0;
  const lead = finals
    ? `Your photos at full resolution.${by ? ` Save them by ${by}.` : ""}`
    : `Pick your ${p.included} ${p.included === 1 ? "frame" : "frames"}${by ? ` by ${by}` : ""} and I'll start editing.${picked ? ` You have ${picked} so far.` : ""}`;
  const cta = finals ? "See your photos" : "Open proofs";
  const html = page(
    subject,
    lead,
    `<tr><td class="mono ac" style="${label};padding-bottom:10px">${finals ? "Finals" : "Proofs"}</td></tr>
<tr><td class="mono fg" style="font-size:22px;line-height:1.3;color:${C.fg};padding-bottom:16px">${esc(subject)}.</td></tr>
<tr><td class="mono mu" style="font-size:13px;line-height:1.65;color:${C.mu};padding-bottom:30px">${esc(lead)}</td></tr>
<tr><td style="padding:0 0 30px"><a href="${url}" class="mono cta" style="display:inline-block;padding:14px 20px;background:${C.fg};color:${C.bg};text-decoration:none;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase">${cta}</a></td></tr>`,
  );
  const text = [`${subject}.`, "", lead, "", `${cta}: ${url}`, "", "Questions? Reply to this email.", SIG_TEXT].join("\n");
  return { subject, html, text, attachments: logos() };
}

// The client's copy names frames by proof number, as the gallery does; Lightroom names stay Julian's.
const numberList = (p: Proof) => {
  const order = shotOrder(p.frames).map((f) => f.id);
  return p.selects.map((id) => String(order.indexOf(id) + 1).padStart(3, "0")).sort(byCodeUnit);
};

const fileList = (p: Proof) => p.selects.map((id) => {
  const f = p.frames.find((x) => x.id === id);
  return `${f?.file ?? id}${p.notes[id] ? ` · ${p.notes[id]}` : ""}`;
});

/** The receipt the client gets when they send. */
export function receiptMail(p: Proof) {
  const x = extras(p.selects.length, p.included, p.price);
  const files = numberList(p);
  const paid = p.paid ? `$${(p.paid.amount / 100).toFixed(2)}` : "";
  const summary: [string, string][] = [["Selected", String(p.selects.length)], ["Included", String(p.included)], ["Extra", String(x.n)], ...(paid ? [["Paid", paid] as [string, string]] : [])];
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

/** Julian's alert to hello@: plain lines for `alertHello()` in lib/email/hello-mail. */
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
      "In Lightroom: Library > Plug-in Extras > Sync with proof.",
    ],
  };
}

/** What a client did, as it happens, for a gallery on "each". Open, send and download only. */
export function actionAlert(p: Proof, who: string, kind: "open" | "download", id?: string): { subject: string; lines: string[] } {
  const name = p.viewers?.[who.toLowerCase()]?.name;
  const by = name ? `${name} (${who})` : who;
  const file = id === "all" ? "all photos as one zip" : p.finals?.find((f) => f.id === id)?.file ?? id ?? "a photo";
  const what = kind === "open" ? `opened ${p.deliveredAt ? "the delivery" : "the proofs"}` : `downloaded ${file}`;
  return { subject: `${kind === "open" ? "Opened" : "Downloaded"}: ${p.name}`, lines: [`${by} ${what} of ${p.name}.`, "", (p.deliveredAt ? deliveryUrl : proofUrl)(publicId(p))] };
}

const COUNTED = { open: "opened", pick: "picked", send: "sent selects", download: "downloaded" } as const;
type Counted = keyof typeof COUNTED;

/**
 * The daily summary for galleries on "daily": who opened, picked, sent and downloaded between `since` and `until`.
 * Null when nothing happened, so a quiet day sends nothing. Test addresses (QA) never count.
 */
export function digestMail(proofs: Proof[], since: string, until: string): { subject: string; lines: string[] } | null {
  const out: string[] = [];
  let total = 0;
  for (const p of proofs) {
    if (p.notify !== "daily") continue;
    const rows: string[] = [];
    for (const [who, v] of Object.entries(p.viewers ?? {})) {
      if (isTestEmail(who)) continue;
      const n: Partial<Record<Counted, number>> = {};
      for (const e of v.events) if (e.at > since && e.at <= until && e.kind in COUNTED) n[e.kind as Counted] = (n[e.kind as Counted] ?? 0) + 1;
      const said = (Object.keys(COUNTED) as Counted[]).filter((k) => n[k]).map((k) => (k === "send" ? COUNTED[k] : `${COUNTED[k]} ${n[k]}${k === "open" ? (n[k] === 1 ? " time" : " times") : ""}`));
      if (said.length) rows.push(`  ${v.name ? `${v.name} (${who})` : who}: ${said.join(", ")}`);
    }
    if (!rows.length) continue;
    total += rows.length;
    out.push(`${p.name}`, ...rows, `  ${(p.deliveredAt ? deliveryUrl : proofUrl)(publicId(p))}`, "");
  }
  if (!out.length) return null;
  return { subject: `Galleries today: ${total} ${total === 1 ? "visitor" : "visitors"}`, lines: ["Since yesterday's summary:", "", ...out.slice(0, -1)] };
}

/** Whether this open or download is worth a mail: not a test address, and not the same thing again within `gap` minutes. */
export function worthMail(events: ViewerEvent[], kind: "open" | "download", at: string, gap: number): boolean {
  const before = events.filter((e) => e.kind === kind && e.at < at).at(-1);
  return !before || Date.parse(at) - Date.parse(before.at) > gap * 60_000;
}

/** Julian's own subject for a proof or delivery mail: one line, control characters out, 150 at most; empty keeps the default. */
export function subjectOr(given: unknown, fallback: string): string {
  const v = typeof given === "string" ? given.replace(/[\x00-\x1f\x7f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 150) : "";
  return v || fallback;
}

/** `cc`: the other people on the lead with "copy on gallery mail" ticked (`copiesFor` in lib/leads/lead-store). */
export async function sendClient(mailer: CloudflareEnv["CLIENT_EMAIL"] | undefined, to: string, m: { subject: string; html: string; text: string; attachments: (Inline | Attached)[] }, cc: string[] = []): Promise<boolean> {
  if (!mailer) return false;
  // Plain addresses: Cloudflare refuses an EmailAddress without a name (live 2026-11-11, every client mail failed).
  const head = { to, from: FROM, replyTo: REPLY_TO, ...(cc.length ? { cc } : {}) };
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
      // A copy address refused must not stop the client's own mail.
      if (!cc.length) return false;
      return sendClient(mailer, to, m);
    }
  }
}

/* ── contracts: the link to sign, and the signed copy ── */

type ContractMailIn = { id: string; to: { name: string }; text: string; signed?: { name: string; at: string; hash: string; email: string } };
const contractLink = (id: string) => `${SITE}/contract/${id}`;
const first = (name: string) => name.split(/\s+/)[0] ?? "";

/** "Your contract": the link to read and sign it. */
export function contractMail(c: ContractMailIn) {
  const url = contractLink(c.id);
  const lead = `Hi ${first(c.to.name)}, here is the contract for the shoot. Read it, type your name and sign online. It takes a minute.`;
  const html = page(
    "Your contract",
    "Read and sign the contract online.",
    `<tr><td class="mono ac" style="${label};padding-bottom:10px">Contract</td></tr>
<tr><td class="mono fg" style="font-size:22px;line-height:1.3;color:${C.fg};padding-bottom:16px">Your contract.</td></tr>
<tr><td class="mono mu" style="font-size:13px;line-height:1.65;color:${C.mu};padding-bottom:30px">${esc(lead)}</td></tr>
<tr><td style="padding:0 0 30px"><a href="${url}" class="mono cta" style="display:inline-block;padding:14px 20px;background:${C.fg};color:${C.bg};text-decoration:none;font-size:12px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase">Read and sign</a></td></tr>`,
  );
  const text = ["Your contract.", "", lead, "", `Read and sign: ${url}`, "", "Questions? Reply to this email.", SIG_TEXT].join("\n");
  return { subject: "Your contract", html, text, attachments: logos() };
}

/** The client's copy once signed: the whole text and the signature record, with the signed copy (and its drawn signature) attached. */
export function signedMail(c: ContractMailIn, copy?: { html: string; filename: string }) {
  const s = c.signed!;
  const when = new Intl.DateTimeFormat("en-US", { timeZone: TZ, dateStyle: "long", timeStyle: "short" }).format(new Date(s.at));
  const record: [string, string][] = [["Signed by", s.name], ["Signed at", when], ["SHA-256", s.hash]];
  const lead = copy ? "Thanks for signing. Your signed copy is attached, below and on the same link any time." : "Thanks for signing. Your copy is below and on the same link any time.";
  const html = page(
    "Contract signed",
    "Thanks for signing. Your copy is inside.",
    `<tr><td class="mono ac" style="${label};padding-bottom:10px">Signed</td></tr>
<tr><td class="mono fg" style="font-size:22px;line-height:1.3;color:${C.fg};padding-bottom:16px">Contract signed.</td></tr>
<tr><td class="mono mu" style="font-size:13px;line-height:1.65;color:${C.mu};padding-bottom:30px">${esc(lead)} <a href="${contractLink(c.id)}" style="color:inherit;word-break:break-all">${contractLink(c.id)}</a></td></tr>
${rows(record)}
<tr><td class="mono fg rule" style="${C.rule};font-size:12px;line-height:1.7;color:${C.fg};padding-top:18px;white-space:pre-wrap">${esc(c.text)}</td></tr>`,
  );
  const text = ["Contract signed.", "", lead, contractLink(c.id), "", ...record.map(([k, v]) => `${k}: ${v}`), "", c.text, "", SIG_TEXT].join("\n");
  const file: Attached[] = copy ? [{ content: new TextEncoder().encode(copy.html), filename: copy.filename, type: "text/html", disposition: "attachment" }] : [];
  return { subject: "Contract signed", html, text, attachments: [...logos(), ...file] };
}
