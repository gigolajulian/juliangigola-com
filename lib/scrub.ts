/* ── logs carry no personal data ──────────────────────────────────
 * Server logs keep a label and a status. Upstream error text can still
 * echo an address, a phone number or a key, so `scrubConsole` wraps the
 * console once per isolate (instrumentation.ts `register`, and the
 * booking Worker's module) and `scrub` masks them in every argument.
 * Names cannot be told from words: call sites log ids and statuses,
 * never a client's name, subject line or a response body.
 * ─────────────────────────────────────────────────────────────── */

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// US numbers in any common spelling, or + and a country code; dates and ids do not match.
const PHONE = /(?<![\w-])(?:\+1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?![\w-])|\+\d{1,3}[ \d().-]{8,}\d/g;
const SECRET = /\b(?:sk|rk|pk|whsec)_(?:live|test)_\w+|\bgh[pousr]_\w{20,}|\bgithub_pat_\w+|\bBearer\s+[\w.~+/=-]+/g;

/** The text with addresses, phone numbers and keys masked. */
export const scrub = (text: string) => text.replace(SECRET, "[secret]").replace(EMAIL, "[email]").replace(PHONE, "[phone]");

const clean = (v: unknown): unknown =>
  typeof v === "string" ? scrub(v) : v instanceof Error ? scrub(`${v.name}: ${v.message}`) : v;

let done = false;
/** Masks every console argument from here on. Safe to call more than once. */
export function scrubConsole() {
  if (done) return;
  done = true;
  for (const level of ["log", "info", "warn", "error"] as const) {
    const raw = console[level].bind(console);
    console[level] = (...args: unknown[]) => raw(...args.map(clean));
  }
}
