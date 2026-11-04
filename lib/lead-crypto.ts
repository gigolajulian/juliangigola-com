/* ── leads, sealed ────────────────────────────────────────────────
 * Julian (2026-11-03): the lead desk "hidden from all seo and encrypted".
 * A lead carries a name, an email, what they want and when; KV already
 * encrypts at rest, but anyone holding a Cloudflare token could read it.
 * So every `lead:` row is sealed with AES-GCM under the Worker secret
 * LEADS_KEY (32 random bytes, base64), and its KV key is an HMAC of the
 * address, so no email shows in a key listing either.
 *
 * Two keys derived from the one secret, one per job, so the same bytes
 * never serve both AES and HMAC. Web Crypto only: runs in the Worker and
 * in Node for the tests.
 * ─────────────────────────────────────────────────────────────── */

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export type Sealer = {
  /** The person's id: an HMAC of their address, 32 hex characters. */
  id(email: string): Promise<string>;
  /** "<iv>.<ciphertext>", base64. A fresh IV every time. */
  seal(value: unknown): Promise<string>;
  open<T>(sealed: string): Promise<T>;
};

const cache = new Map<string, Promise<Sealer>>();

/** The sealer for a secret, or null when LEADS_KEY is unset or not 32 bytes. */
export function sealer(secret: string | undefined): Promise<Sealer> | null {
  if (!secret) return null;
  let raw: Uint8Array;
  try {
    raw = unb64(secret.trim());
  } catch {
    return null;
  }
  if (raw.length !== 32) return null;
  if (!cache.has(secret)) cache.set(secret, make(raw));
  return cache.get(secret)!;
}

async function make(raw: Uint8Array): Promise<Sealer> {
  const derive = async (label: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array([...enc.encode(label), ...raw])));
  const aes = await crypto.subtle.importKey("raw", await derive("jg-leads:seal"), "AES-GCM", false, ["encrypt", "decrypt"]);
  const mac = await crypto.subtle.importKey("raw", await derive("jg-leads:id"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return {
    async id(email) {
      const sig = new Uint8Array(await crypto.subtle.sign("HMAC", mac, enc.encode(email.trim().toLowerCase())));
      return [...sig.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
    },
    async seal(value) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, enc.encode(JSON.stringify(value))));
      return `${b64(iv)}.${b64(ct)}`;
    },
    async open<T>(sealed: string) {
      const [iv, ct] = sealed.split(".");
      return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, aes, unb64(ct)))) as T;
    },
  };
}
