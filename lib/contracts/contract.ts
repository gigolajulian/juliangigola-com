/* ── contracts, signed online ─────────────────────────────────────
 * Julian (2026-11-15, the Format comparison, #14): a contract is a text
 * body, the client's name, email and address, Send or Copy URL, and the
 * client signs at /contract/<id>. Templates are plain text with fields
 * ({client}, {date}, {fee}, {deposit}, {usage}) filled from the lead; he
 * edits the result, then sends it.
 *
 * One `contract:<id>` record per contract in INBOX, sealed with LEADS_KEY
 * like proofs and leads, and `leadcontract:<lead id>` pointing at the
 * lead's latest one. The id is 16 base62 characters (`newToken`, about 95
 * bits): the only secret on the public page.
 *
 * Signing keeps who and when: the typed name, the email, IP, user agent,
 * and a SHA-256 of the exact text. The page posts back the hash it showed,
 * so a text he changed while the page was open is never signed blind.
 * Once signed the text is locked and a second signature is refused.
 * ─────────────────────────────────────────────────────────────── */

import { TZ } from "@/lib/booking/booking-rules";
import { DEPOSIT, type InvoiceFrom } from "@/lib/leads/invoice";
import type { Lead } from "@/lib/leads/leads";
import type { InboxKV as KV } from "@/lib/leads/lead-store";
import { isEmail, newToken } from "@/lib/proofs/proof";

export type ContractTemplate = { id: string; name: string; body: string };

/** A starting point only: Julian pastes his own terms (from Format) over it in Templates. */
export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: "shoot",
    name: "Photography Services Agreement",
    body: "Photography Services Agreement\n\nThis Agreement is made on {today} between:\nPhotographer: Julian Gigola\nClient: {client}\n\n1. Scope of Work\nThe Photographer agrees to provide the following photography services:\nType of services: to be set\nDate, time and location: {date}, location to be set\nSession length: to be set\nDeliverables: to be set\nThe Photographer selects, edits and grades the final images in his own style. Unedited and RAW files are not delivered. Time beyond the agreed session length is added only if both parties agree in writing, at a rate set before it starts.\n\n2. Compensation\nTotal payment: {fee}\nDeposit: {deposit}, paid to hold the date and credited toward the total. The date is held only once the deposit is paid.\nFinal payment due: to be set\nAdditional costs: none, unless agreed in writing beforehand.\nFinal images are delivered only after payment in full. A payment more than 14 days late may delay delivery or cancel the services, and any amounts already paid stay with the Photographer as payment for work done.\nThe Client agrees not to dispute or charge back payments for services that were provided under this Agreement.\n\n3. Delivery\nDelivery date: to be set\nMethod of delivery: online gallery\nThe Client should download the files once delivered. The Photographer keeps a backup for 90 days after delivery and is not responsible for files after that.\n\n4. Copyright and Image Usage\nThe Photographer owns the copyright in all images taken. Once paid in full, the Client receives a limited, non-exclusive, non-transferable license for the following use:\nUsage granted: {usage}\nAny other use, including commercial use, advertising, resale, sublicensing, contest entries or training artificial intelligence, needs the Photographer's written permission.\nRestrictions on use: The Client may not edit, alter, or apply filters to any images without the Photographer's prior written consent. Cropping to fit a platform is allowed.\nAttribution: When posting on social media or public platforms, the Client must credit the Photographer as @juliangigola.\n\n5. Client Responsibilities\nThe Client is responsible for access to the location, any permits, and venue or location fees, unless agreed otherwise in writing.\nThe session starts at the agreed time. Late arrival does not extend it. If the Client is more than 30 minutes late without notice, the session counts as cancelled under 48 hours.\nThe Client confirms that everyone they bring to the session agrees to be photographed. Anyone under 18 attends only with a parent or guardian present.\n\n6. Cancellation and Rescheduling\nCancellation or rescheduling needs written notice, by email, at least 48 hours before the session.\nCancelled by the Client 48 hours or more before the session: the deposit is refunded.\nCancelled by the Client under 48 hours before, or a no-show: the deposit is kept.\nRescheduling: with at least 48 hours' notice, the session moves once to another open date and the deposit carries over. A later change is a cancellation.\nCancelled by the Photographer: the Client chooses a new date or a full refund of everything paid. This refund is the Photographer's only obligation.\nOutdoor sessions may move to a new date for unsafe weather, at no cost to either party.\n\n7. Model Release\nThe Client grants the Photographer the right to use images from the session for promotional purposes, including the Photographer's portfolio, website, social media and marketing materials. The Client may opt out by writing to the Photographer before the session. The Photographer will not license the Client's likeness to a third party for advertising without the Client's written consent.\n\n8. Safety and Conduct\nThe Photographer may end the session early if conditions become unsafe or if anyone present behaves in a threatening or harassing way. In that case, payments already made are kept.\n\n9. Liability and Force Majeure\nThe Photographer will take all reasonable precautions to ensure the safety and quality of the session. The Photographer is not liable for:\n- Loss or damage due to circumstances beyond his control, such as natural disasters, illness, equipment failure or file corruption.\n- Injury or damage to persons or property during the session, except where caused by his gross negligence.\n- Indirect, incidental or consequential damages of any kind.\nThe Photographer's total liability under this Agreement is limited to the amounts the Client has paid.\nIn the event of force majeure, both parties will work to reschedule the session or agree on an alternative. If that is not possible, the Client receives a refund of amounts paid for work not yet done.\n\n10. Governing Law and Disputes\nThis Agreement is governed by the laws of the State of California. Any dispute will be heard in the courts of Santa Clara County, California, including small claims court.\n\n11. Entire Agreement\nThis Agreement is the entire understanding between the Photographer and the Client and replaces any prior agreements. Changes must be agreed in writing by both parties; email counts as writing. If any part of this Agreement is found unenforceable, the rest still applies. Notices go to the email addresses each party uses for this booking.\n\n12. Signatures\nThe Photographer agrees to these terms by sending this Agreement. The Client agrees by signing online below. Both parties agree that this electronic signature is as binding as a handwritten one. The typed name, email and time of signing are recorded with this exact text.",
  },
];

/** Lines the desk must fill before a contract can go out. */
export const UNSET = /\bto be set\b/i;

export type Signature = { name: string; email: string; ip: string; ua: string; at: string; hash: string };

export type Contract = {
  id: string;
  /** The lead's KV id (`lead:<id>`). */
  lead: string;
  /** The template it started from, for the desk. */
  template?: string;
  to: { name: string; email: string; address?: string };
  /** His business details at send time: name, address lines, email. Never the bank or EIN. */
  from?: string[];
  text: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  /** Set once, on signing; the text is locked from here. */
  signed?: Signature;
};

export const contractKey = (id: string) => `contract:${id}`;
export const leadContractKey = (lead: string) => `leadcontract:${lead}`;
export const isContractId = (v: unknown): v is string => typeof v === "string" && /^[0-9A-Za-z]{16}$/.test(v);
export const contractUrl = (id: string) => `https://juliangigola.com/contract/${id}`;

/** Hex SHA-256 of the text as stored, byte for byte (UTF-8). */
export async function sha256(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const longDay = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(new Date(iso));

/** A template's fields filled from a lead. Unknown values stay readable blanks for him to fill. */
export function fillContract(body: string, l: Pick<Lead, "name" | "when" | "quote" | "licence">, today = new Date().toISOString()): string {
  const usage = l.licence ? `${l.licence.use || "Licensed use"}, until ${new Date(`${l.licence.end}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}` : "Personal use";
  return body
    .replace(/\{client\}/g, l.name)
    .replace(/\{date\}/g, l.when ? longDay(l.when) : "to be set")
    .replace(/\{today\}/g, longDay(today))
    .replace(/\{fee\}/g, l.quote !== undefined ? usd(l.quote) : "to be set")
    .replace(/\{deposit\}/g, usd(DEPOSIT))
    .replace(/\{usage\}/g, usage);
}

/** Templates as he saved them, or the starting one; anything malformed is dropped. */
export function cleanContractTemplates(v: unknown): ContractTemplate[] {
  if (!Array.isArray(v)) return CONTRACT_TEMPLATES;
  return v
    .filter((t): t is ContractTemplate => !!t && typeof t === "object" && typeof t.name === "string" && typeof t.body === "string")
    .slice(0, 20)
    .map((t, i) => ({ id: typeof t.id === "string" && t.id ? t.id.slice(0, 40) : `c${i}`, name: t.name.slice(0, 60), body: t.body.slice(0, 20000) }));
}

/** The business block on the contract: name, address and email from the invoice details. */
export const fromLines = (f: Partial<InvoiceFrom> | null | undefined) => [f?.name, f?.a1, f?.a2, f?.a3, f?.email].filter((x): x is string => !!x?.trim()).map((x) => x.trim());

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** What the desk may set on a contract, checked. */
export function cleanDraft(given: Record<string, unknown>): { to: Contract["to"]; text: string; template?: string } | { error: string } {
  const to = (given.to ?? {}) as Record<string, unknown>;
  const text = typeof given.text === "string" ? given.text.replace(/\r\n/g, "\n").slice(0, 20000) : "";
  if (!text.trim()) return { error: "The contract has no text." };
  const name = clip(to.name, 120);
  if (!name) return { error: "The client's name, please." };
  const email = clip(to.email, 200);
  if (email && !isEmail(email)) return { error: "That email does not look right." };
  return { to: { name, email, ...(clip(to.address, 300) ? { address: clip(to.address, 300) } : {}) }, text, ...(typeof given.template === "string" ? { template: given.template.slice(0, 40) } : {}) };
}

/** A new contract, or the draft changed. A signed one never changes. */
export function draft(c: Contract | null, lead: string, d: { to: Contract["to"]; text: string; template?: string }, at: string): Contract | { error: string } {
  if (c?.signed) return { error: "Signed contracts are locked." };
  return { ...(c ?? { id: newToken(), lead, createdAt: at }), ...d, updatedAt: at };
}

/** The client's signature, or why it was refused. `seen` is the hash the page showed them. */
export async function sign(c: Contract, by: { name: unknown; email: unknown; agree: unknown; seen: unknown; ip: string; ua: string }, at: string): Promise<Contract | { error: string; status: number }> {
  if (c.signed) return { error: "This contract is already signed.", status: 409 };
  const name = clip(by.name, 120);
  if (name.length < 2) return { error: "Type your full name.", status: 400 };
  if (!isEmail(by.email)) return { error: "That email does not look right.", status: 400 };
  if (by.agree !== true) return { error: "Tick I agree to sign.", status: 400 };
  const hash = await sha256(c.text);
  if (by.seen !== hash) return { error: "This contract changed since you opened it. Reload the page to read the new text.", status: 409 };
  return { ...c, signed: { name, email: by.email.trim(), ip: by.ip.slice(0, 64), ua: by.ua.slice(0, 400), at, hash } };
}

type Seal = { seal(v: unknown): Promise<string>; open<T>(s: string): Promise<T> };

export async function readContract(kv: KV, s: Seal, id: string): Promise<Contract | null> {
  if (!isContractId(id)) return null;
  const raw = await kv.get(contractKey(id));
  if (!raw) return null;
  try {
    return await s.open<Contract>(raw);
  } catch {
    return null;
  }
}

/** Sealed whole; the lead's pointer is plain (an id, never a name). */
export async function writeContract(kv: KV, s: Seal, c: Contract): Promise<void> {
  await kv.put(contractKey(c.id), await s.seal(c));
  await kv.put(leadContractKey(c.lead), c.id);
}

export async function contractOf(kv: KV, s: Seal, lead: string): Promise<Contract | null> {
  const id = await kv.get(leadContractKey(lead));
  return id ? readContract(kv, s, id) : null;
}

/** What the signing page gets: no lead id. */
export const publicContract = async (c: Contract) => ({
  to: c.to,
  from: c.from ?? [],
  text: c.text,
  hash: await sha256(c.text),
  signed: c.signed ? { name: c.signed.name, at: c.signed.at, hash: c.signed.hash } : null,
});
export type PublicContract = Awaited<ReturnType<typeof publicContract>>;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const stamp = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, dateStyle: "long", timeStyle: "long" }).format(new Date(iso));

/** The signed copy: one self-contained page, printable to PDF. Everything the client typed is escaped. */
export function signedCopy(c: Contract): string {
  const s = c.signed;
  const rows: [string, string][] = s
    ? [["Signed by", s.name], ["Email", s.email], ["Signed at", stamp(s.at)], ["IP address", s.ip], ["Device", s.ua], ["SHA-256 of the text", s.hash], ["Contract", contractUrl(c.id)]]
    : [["Status", "Not signed yet"]];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Contract, ${esc(c.to.name)}</title>
<style>body{margin:0;background:#fff;color:#141211;font:14px/1.6 ui-monospace,Menlo,Consolas,monospace}main{max-width:680px;margin:0 auto;padding:48px 24px}h1{font-size:13px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 24px}.who{display:flex;gap:48px;flex-wrap:wrap;margin-bottom:32px;color:#515354}.text{white-space:pre-wrap;border-top:1px solid #ddd;padding-top:24px}table{border-collapse:collapse;width:100%;margin-top:40px;font-size:12px}td{border-top:1px solid #ddd;padding:8px 0;vertical-align:top;word-break:break-all}td:first-child{color:#515354;width:34%}</style>
</head><body><main><h1>Contract</h1>
<div class="who"><div>${(c.from ?? ["Julian Gigola"]).map(esc).join("<br>")}</div><div>${[c.to.name, c.to.email, c.to.address ?? ""].filter(Boolean).map(esc).join("<br>")}</div></div>
<div class="text">${esc(c.text)}</div>
<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
</main></body></html>`;
}

export const copyName = (c: Contract) => `Contract - ${c.to.name.replace(/[\\/:*?"<>|]/g, "").trim() || "client"}.html`;
