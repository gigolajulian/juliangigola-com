import { afterEach, describe, expect, it, vi } from "vitest";
import { b64url, contentKeys, encrypt, publicKey, send, unb64url, vapid, type Subscription } from "@/lib/leads/web-push";

/** A browser's side: its own key pair and auth secret, as pushManager.subscribe makes them. */
async function device() {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub: Subscription = { endpoint: "https://web.push.apple.com/abc", keys: { p256dh: b64url(raw), auth: b64url(auth) } };
  return { pair, raw, auth, sub };
}

/** Decrypts what `encrypt` made, the way the browser does. */
async function open(body: Uint8Array, d: Awaited<ReturnType<typeof device>>) {
  const salt = body.slice(0, 16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const as = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: as }, d.pair.privateKey, 256));
  const { cek, nonce } = await contentKeys(ecdh, d.auth, d.raw, asPublic, salt);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, body.slice(21 + idlen)));
  expect(plain.at(-1)).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

const vapidKey = async () => {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return { pair, jwk: await crypto.subtle.exportKey("jwk", pair.privateKey) };
};

afterEach(() => vi.unstubAllGlobals());

describe("web push", () => {
  it("encrypts a payload only the subscribed device can read, in the aes128gcm layout", async () => {
    const d = await device();
    const body = await encrypt(d.sub, '{"title":"New inquiry"}');
    expect([...body.slice(16, 20)]).toEqual([0, 0, 16, 0]);
    expect(body[20]).toBe(65);
    expect(await open(body, d)).toBe('{"title":"New inquiry"}');
  });

  it("signs a VAPID token for the push service's origin that the public key verifies", async () => {
    const { pair, jwk } = await vapidKey();
    const header = await vapid(jwk, "https://web.push.apple.com/abc", Date.UTC(2026, 10, 4));
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(publicKey(jwk));
    const [h, c, s] = t.split(".");
    expect(JSON.parse(new TextDecoder().decode(unb64url(c)))).toMatchObject({ aud: "https://web.push.apple.com", sub: "mailto:hello@juliangigola.com" });
    const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, pair.publicKey, unb64url(s), new TextEncoder().encode(`${h}.${c}`));
    expect(ok).toBe(true);
  });

  it("posts to the endpoint, reports a device that unsubscribed, and never throws", async () => {
    const { jwk } = await vapidKey();
    const d = await device();
    const seen: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_: string, init: RequestInit) => (seen.push(init), new Response(null, { status: 201 })));
    expect(await send(JSON.stringify(jwk), d.sub, { title: "New inquiry", body: "Maya, portrait" })).toBe("ok");
    expect(seen[0].headers).toMatchObject({ "content-encoding": "aes128gcm", ttl: "86400" });
    expect(JSON.parse(await open(seen[0].body as Uint8Array, d))).toEqual({ title: "New inquiry", body: "Maya, portrait" });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 410 }));
    expect(await send(JSON.stringify(jwk), d.sub, { title: "x", body: "y" })).toBe("gone");
    expect(await send("not json", d.sub, { title: "x", body: "y" })).toBe("failed");
  });
});
