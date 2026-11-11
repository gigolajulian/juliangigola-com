/* ── the client's reschedule and cancel links ─────────────────────
 * `/booking/<id>?t=<exp>.<sig>`: sig is HMAC-SHA256 of `<id>.<exp>` keyed
 * with the Worker secret BOOKING_SECRET, base64url. Only the mail that
 * carries it opens the booking; a link stops working a day after the
 * session it was sent for. No secret, no links: the mail leaves them out.
 * ─────────────────────────────────────────────────────────────── */

const SITE = "https://juliangigola.com";
const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => Buffer.from(buf).toString("base64url");

const key = (secret: string, use: "sign" | "verify") => crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [use]);

/** The token for booking `id`, good until `exp` (ms). */
export async function bookingToken(secret: string, id: string, exp: number) {
  const e = Math.floor(exp / 1000);
  return `${e}.${b64url(await crypto.subtle.sign("HMAC", await key(secret, "sign"), enc.encode(`${id}.${e}`)))}`;
}

/** Whether `token` opens booking `id` now. */
export async function tokenOpens(secret: string | undefined, id: string, token: string | null | undefined, now = Date.now()) {
  const m = /^(\d{9,11})\.([A-Za-z0-9_-]{43})$/.exec(token ?? "");
  if (!secret || !m || +m[1] * 1000 < now) return false;
  // `verify` compares in constant time.
  return crypto.subtle.verify("HMAC", await key(secret, "verify"), Buffer.from(m[2], "base64url"), enc.encode(`${id}.${m[1]}`));
}

/** The two links for the client's mail, or null while BOOKING_SECRET is unset. */
export async function manageLinks(secret: string | undefined, r: { id: string; start: string }) {
  if (!secret) return null;
  const page = `${SITE}/booking/${r.id}?t=${await bookingToken(secret, r.id, Date.parse(r.start) + 864e5)}`;
  return { reschedule: `${page}&do=reschedule`, cancel: `${page}&do=cancel` };
}
