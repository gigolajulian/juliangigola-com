/* ── leads, sealed ────────────────────────────────────────────────
 * The lead desk is hidden from search and encrypted.
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

import { canonical } from "./leads";

const enc = new TextEncoder();
const dec = new TextDecoder();

/** In chunks: spreading a whole invoice photo (100KB+) into one call overflows the stack. */
const b64 = (u: Uint8Array) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export type Sealer = {
  /** The person's id: an HMAC of their address, 32 hex characters. */
  id(email: string): Promise<string>;
  /** The id, then the one from before Gmail dots were ignored when it differs:
      `gone:` tombstones carry no address, so they keep the old id. */
  ids(email: string): Promise<string[]>;
  /** "<iv>.<ciphertext>", base64. A fresh IV every time. */
  seal(value: unknown): Promise<string>;
  open<T>(sealed: string): Promise<T>;
};

/** Just the box: what a store of sealed records needs from a Sealer. */
export type Seal = Pick<Sealer, "seal" | "open">;

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
  const hmac = async (text: string) => {
    const sig = new Uint8Array(await crypto.subtle.sign("HMAC", mac, enc.encode(text)));
    return [...sig.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  return {
    id: (email) => hmac(canonical(email)),
    async ids(email) {
      const [now, before] = await Promise.all([hmac(canonical(email)), hmac(email.trim().toLowerCase())]);
      return now === before ? [now] : [now, before];
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
