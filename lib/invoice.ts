/* ── invoices from a lead ─────────────────────────────────────────
 * Julian (2026-11-06, Leads plan A1): an invoice from the lead, in the
 * template of his JG INVOICE GENERATOR, numbered MMYY, a second one in the
 * same month 1126-2. It never sends: the desk makes the PDF and hands it
 * to Share or a Gmail draft. Pure functions here; `/api/inbox` stores the
 * invoice on the lead (sealed) and `lib/invoice-pdf.ts` draws it.
 * ─────────────────────────────────────────────────────────────── */

export type InvoiceLine = { desc: string; qty: number; rate: number };
/** One invoice as it was made. `date` is the day on it, YYYY-MM-DD. `paid` is the deposit taken off. */
export type Invoice = { no: string; date: string; lines: InvoiceLine[]; paid: number; notes?: string; at: string };
/** His own details on every invoice. Kept sealed in KV, never in the code: the repo is public. */
export type InvoiceFrom = { name: string; a1: string; a2: string; a3: string; email: string; phone: string; ein: string; signoff: string; notes: string };

/** The site's deposit in dollars: `AMOUNT` in lib/deposit.ts, which the desk's bundle must not import. */
export const DEPOSIT = 100;
/** Lines that fit above the notes block on the page. */
export const MAX_LINES = 8;

/** "2026-11-06" as "1126". */
export const mmyy = (date: string) => date.slice(5, 7) + date.slice(2, 4);
/** The number for an invoice dated `date` when `taken` invoices already carry that month: 1126, 1126-2, 1126-3. */
export const invoiceNo = (date: string, taken: number) => (taken > 0 ? `${mmyy(date)}-${taken + 1}` : mmyy(date));

const cents = (n: number) => Math.round(n * 100) / 100;
export const subtotal = (lines: InvoiceLine[]) => cents(lines.reduce((s, l) => s + l.qty * l.rate, 0));
export const balance = (i: Pick<Invoice, "lines" | "paid">) => cents(subtotal(i.lines) - i.paid);
export const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    const qty = amount(raw?.qty), rate = amount(raw?.rate), desc = text(raw?.desc, 60);
    if (!desc || qty === null || rate === null) return { error: "Every line needs a description, a quantity and a rate." };
    lines.push({ desc, qty, rate });
  }
  const paid = amount(o.paid ?? 0);
  if (paid === null || paid < 0) return { error: "Bad deposit." };
  const notes = text(o.notes, 600);
  return { date, lines, paid, ...(notes ? { notes } : {}) };
}

const FROM_KEYS = ["name", "a1", "a2", "a3", "email", "phone", "ein", "signoff", "notes"] as const;
export function cleanFrom(v: unknown): InvoiceFrom {
  const o = (v ?? {}) as Record<string, unknown>;
  return Object.fromEntries(FROM_KEYS.map((k) => [k, text(o[k], k === "notes" ? 600 : 80)])) as InvoiceFrom;
}
