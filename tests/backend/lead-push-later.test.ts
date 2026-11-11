import { afterEach, expect, it, vi } from "vitest";

/* In the Worker the push goes to waitUntil: a push service that never
   answers must not hold up the form, Cal.com or Stripe. */
const waits: Promise<unknown>[] = [];
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ ctx: { waitUntil: (p: Promise<unknown>) => waits.push(p) } }) }));

const { recordLead } = await import("@/lib/leads/lead-store");

afterEach(() => vi.unstubAllGlobals());

it("records the lead without waiting on a push service that hangs", async () => {
  const LEADS_KEY = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"])) as CryptoKeyPair;
  const VAPID_KEY = JSON.stringify(await crypto.subtle.exportKey("jwk", pair.privateKey));
  const ua = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const b64 = (u: ArrayBuffer | Uint8Array) => Buffer.from(u as ArrayBuffer).toString("base64url");
  const sub = { endpoint: "https://web.push.apple.com/x", keys: { p256dh: b64(await crypto.subtle.exportKey("raw", ua.publicKey)), auth: b64(crypto.getRandomValues(new Uint8Array(16))) } };
  const data = new Map<string, string>([["push:abc", JSON.stringify(sub)]]);
  const kv = {
    get: async (k: string) => data.get(k) ?? null,
    put: async (k: string, v: string) => void data.set(k, v),
    delete: async (k: string) => void data.delete(k),
    list: async ({ prefix }: { prefix: string }) => ({ keys: [...data.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })) }),
  };
  vi.stubGlobal("fetch", () => new Promise(() => {}));
  const lead = await recordLead({ INBOX: kv as never, LEADS_KEY, VAPID_KEY }, "maya@example.com", { event: { at: "2026-11-04T10:00:00Z", kind: "inquiry", ref: "msg:1" }, name: "Maya" });
  expect(lead?.name).toBe("Maya");
  expect(waits).toHaveLength(1);
});
