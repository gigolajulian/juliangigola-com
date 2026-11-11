/* ── Web Push, by hand ────────────────────────────────────────────
 * Julian (2026-11-04): "start push notifications next". A new lead pings
 * the installed Leads app on his iPhone and desktop. Web Crypto only, so it
 * runs in the Worker with no dependency: the payload is encrypted for each
 * device (RFC 8291, aes128gcm) and the request signed with the site's VAPID
 * key (RFC 8292). VAPID_KEY is one Worker secret: the private key as a JWK,
 * which also carries the public half the browser subscribes with.
 * ─────────────────────────────────────────────────────────────── */

export type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export type Push = { title: string; body: string; tag?: string; url?: string };

const enc = new TextEncoder();
type Bytes = Uint8Array<ArrayBuffer>;
export const b64url = (u: Bytes) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const join = (...parts: Bytes[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) out.set(p, (at += p.length) - p.length);
  return out;
};

/** The public key browsers subscribe with: the raw point, base64url. */
export function publicKey(jwk: JsonWebKey): string {
  return b64url(join(new Uint8Array([4]), unb64url(jwk.x!), unb64url(jwk.y!)));
}

/** HKDF-SHA-256 (extract and expand) to `bytes` bytes. */
async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, bytes: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** The derived content key and nonce for one message (RFC 8291 section 3.4). */
export async function contentKeys(ecdh: Bytes, auth: Bytes, uaPublic: Bytes, asPublic: Bytes, salt: Bytes) {
  const ikm = await hkdf(auth, ecdh, join(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  return {
    cek: await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16),
    nonce: await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12),
  };
}

/** The encrypted body for one device: one aes128gcm record. */
export async function encrypt(sub: Subscription, payload: string): Promise<Bytes> {
  const uaPublic = unb64url(sub.keys.p256dh);
  const auth = unb64url(sub.keys.auth);
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const ua = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: ua }, pair.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const { cek, nonce } = await contentKeys(ecdh, auth, uaPublic, asPublic, salt);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // 0x02: the last (and only) record.
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, join(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return join(salt, rs, new Uint8Array([asPublic.length]), asPublic, sealed);
}

/** The VAPID Authorization header for one push service. */
export async function vapid(jwk: JsonWebKey, endpoint: string, now = Date.now()): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const part = (o: object) => b64url(enc.encode(JSON.stringify(o)));
  const body = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: "mailto:hello@juliangigola.com" })}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(body)));
  return `vapid t=${body}.${b64url(sig)}, k=${publicKey(jwk)}`;
}

/**
 * Sends one push. Returns "gone" when the push service says the device
 * unsubscribed (404, 410), so the caller can forget it. Never throws.
 */
export async function send(secret: string, sub: Subscription, push: Push): Promise<"ok" | "gone" | "failed"> {
  try {
    const jwk = JSON.parse(secret) as JsonWebKey;
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        authorization: await vapid(jwk, sub.endpoint),
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: "86400",
        urgency: "high",
      },
      body: await encrypt(sub, JSON.stringify(push)),
      signal: AbortSignal.timeout(5000),
    });
    await res.body?.cancel();
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) console.error("push", res.status);
    return res.ok ? "ok" : "failed";
  } catch (e) {
    console.error("push", String(e));
    return "failed";
  }
}
