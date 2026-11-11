/* ── invoices from a lead ─────────────────────────────────────────
 * Julian (2026-11-06, Leads plan A1): an invoice from the lead, in the
 * template of his JG INVOICE GENERATOR, numbered MMYY, a second one in the
 * same month 1126-2. It never sends: the desk makes the PDF and hands it
 * to Share or a Gmail draft. Pure functions here; `/api/inbox` stores the
 * invoice on the lead (sealed) and `lib/leads/invoice-pdf.ts` draws it.
 * ─────────────────────────────────────────────────────────────── */

/** `sub` is design B's short line under a title: what was done. */
export type InvoiceLine = { desc: string; qty: number; rate: number; sub?: string };
/** Where the photo sits in B's photo column: x and y from 0 to 1 as CSS object-position, z the zoom over cover (1 to 3). */
export type Crop = { x: number; y: number; z: number };
/**
 * Design B, the dark page with a photo (Julian, 2026-11-09: "Add this invoice
 * as my default template"). Everything on that page that is not in the lines.
 * `photo` is the KV key of the sealed photo; `tone` is the wordmark's shade
 * over it, read from the pixels under it when the invoice was made.
 */
export type InvoiceB = {
  due: string;
  to: { name: string; company: string; email: string };
  project: string;
  caption: string;
  note: [string, string, string];
  depositNote: string;
  photo: string;
  crop: Crop;
  tone: "dark" | "light";
};
/** One invoice as it was made. `date` is the day on it, YYYY-MM-DD. `paid` is the deposit taken off. `b` marks a design B invoice. */
/** `paidAt`: when it was settled, by a matching Stripe payment or by hand. `unpaid`: marked unpaid by hand, for one made before PAID_BEFORE. */
export type Invoice = { no: string; date: string; lines: InvoiceLine[]; paid: number; notes?: string; at: string; b?: InvoiceB; paidAt?: string; unpaid?: boolean };
/** Julian (2026-11-11), "ok" to marking the invoices made before the activity log as paid: read here, no record rewritten. */
export const PAID_BEFORE = "2026-11-12";
export const isPaid = (i: Pick<Invoice, "paidAt" | "unpaid" | "at">) => !!i.paidAt || (!i.unpaid && i.at < PAID_BEFORE);
/** His own details on every invoice. Kept sealed in KV, never in the code: the repo is public. Bank and tax lines are design B's. */
export type InvoiceFrom = { name: string; a1: string; a2: string; a3: string; email: string; phone: string; ein: string; signoff: string; notes: string; bank: string; routing: string; account: string; late: string; tax: string };

/** The site's deposit in dollars: `AMOUNT` in lib/booking/deposit.ts, which the desk's bundle must not import. */
export const DEPOSIT = 100;
/** Lines that fit above the notes block on the page. */
export const MAX_LINES = 8;
/** Rows that fit on design B, the deposit row counted. */
export const MAX_ROWS_B = 4;
export const NOTE_B: [string, string, string] = ["Thanks for having me back.", "Always a blast with you guys.", "Can't wait for the next one!"];
/** The photo's KV key: `invoice-photo:` and 32 hex of its SHA-256. */
export const PHOTO_KEY = /^invoice-photo:[0-9a-f]{32}$/;

/** "2026-11-06" as "1126". */
export const mmyy = (date: string) => date.slice(5, 7) + date.slice(2, 4);
/** The number for an invoice dated `date` when `taken` invoices already carry that month: 1126, 1126-2, 1126-3. */
export const invoiceNo = (date: string, taken: number) => (taken > 0 ? `${mmyy(date)}-${taken + 1}` : mmyy(date));

const cents = (n: number) => Math.round(n * 100) / 100;
export const subtotal = (lines: InvoiceLine[]) => cents(lines.reduce((s, l) => s + l.qty * l.rate, 0));
export const balance = (i: Pick<Invoice, "lines" | "paid">) => cents(subtotal(i.lines) - i.paid);
export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "2026-11-09" as "9 Nov", or "9 Nov 2026". */
export const dayB = (iso: string, year = false) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${"Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ")[m - 1]}${year ? ` ${y}` : ""}`; };
/** Whole dollars bare, cents when there are some: $1,500 and $1,500.50. The minus is a hyphen: WinAnsi has no U+2212. */
export const usdB = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;


const text = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const amount = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 1e7 ? cents(v) : null);

/** What the desk sent, checked, or why not. */
export function cleanInvoice(v: unknown): Omit<Invoice, "no" | "at"> | { error: string } {
  const o = (v ?? {}) as Record<string, unknown>;
  const date = text(o.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) return { error: "Bad date." };
  if (!Array.isArray(o.lines) || !o.lines.length || o.lines.length > MAX_LINES) return { error: `One to ${MAX_LINES} lines.` };
  const lines: InvoiceLine[] = [];
  for (const raw of o.lines as Record<string, unknown>[]) {
    const qty = amount(raw?.qty), rate = amount(raw?.rate), desc = text(raw?.desc, 48);
    if (!desc || qty === null || rate === null) return { error: "Every line needs a description, a quantity and a rate." };
    lines.push({ desc, qty, rate });
  }
  const paid = amount(o.paid ?? 0);
  if (paid === null || paid < 0) return { error: "Bad deposit." };
  const notes = text(o.notes, 600);
  if (o.b === undefined) return { date, lines, paid, ...(notes ? { notes } : {}) };
  const b = cleanB(o.b, (o.lines as Record<string, unknown>[]).map((l) => l?.sub));
  if ("error" in b) return b;
  if (lines.length + (paid ? 1 : 0) > MAX_ROWS_B) return { error: `${MAX_ROWS_B} rows fit on this invoice, the deposit counted.` };
  lines.forEach((l, i) => { const sub = text(b.subs[i], 60); if (sub) l.sub = sub; });
  return { date, lines, paid, b: b.b };
}

const unit = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
function cleanB(v: unknown, subs: unknown[]): { b: InvoiceB; subs: unknown[] } | { error: string } {
  const o = (v ?? {}) as Record<string, unknown>, to = (o.to ?? {}) as Record<string, unknown>, c = (o.crop ?? {}) as Record<string, unknown>;
  const due = text(o.due, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || isNaN(Date.parse(due))) return { error: "Bad due date." };
  const photo = text(o.photo, 60);
  if (!PHOTO_KEY.test(photo)) return { error: "Add a photo." };
  const x = unit(c.x, 0, 1), y = unit(c.y, 0, 1), z = unit(c.z, 1, 3);
  if (x === null || y === null || z === null) return { error: "Bad framing." };
  const name = text(to.name, 60);
  if (!name) return { error: "Who is it billed to?" };
  const note = Array.isArray(o.note) ? o.note : [];
  return {
    b: {
      due, photo, crop: { x, y, z }, tone: o.tone === "light" ? "light" : "dark",
      to: { name, company: text(to.company, 60), email: text(to.email, 80) },
      project: text(o.project, 40), caption: text(o.caption, 40),
      note: [0, 1, 2].map((i) => text(note[i], 44)) as [string, string, string],
      depositNote: text(o.depositNote, 60),
    },
    subs,
  };
}

const FROM_KEYS = ["name", "a1", "a2", "a3", "email", "phone", "ein", "signoff", "notes", "bank", "routing", "account", "late", "tax"] as const;
export function cleanFrom(v: unknown): InvoiceFrom {
  const o = (v ?? {}) as Record<string, unknown>;
  return Object.fromEntries(FROM_KEYS.map((k) => [k, text(o[k], k === "notes" ? 600 : 80)])) as InvoiceFrom;
}
