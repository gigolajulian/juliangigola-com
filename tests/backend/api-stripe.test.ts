import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/stripe/route";
import { FakeKV } from "./fakes";

/* /api/stripe: Stripe's webhook. Off while a secret is unset, refuses a bad
   signature and a body that is not JSON, and leaves every payment that is
   not the site's own deposit alone. The settle path is covered in
   api-deposit.test.ts. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const WHSEC = "whsec_test";
async function signed(body: string, at = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WHSEC), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${at}.${body}`));
  return `t=${at},v1=${[...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
const deliver = async (body: string, sig?: string) =>
  POST(new Request("https://juliangigola.com/api/stripe", { method: "POST", body, headers: { "stripe-signature": sig ?? (await signed(body)) } }));
const event = (object: unknown, type = "payment_intent.succeeded") => JSON.stringify({ type, data: { object } });

let fetched: string[];
beforeEach(() => {
  fetched = [];
  ctx.env = { INBOX: new FakeKV(), STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: WHSEC };
  vi.stubGlobal("fetch", async (u: string) => {
    fetched.push(u);
    return Response.json({});
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/stripe", () => {
  it("is off while a secret is unset", async () => {
    ctx.env = { ...ctx.env, STRIPE_WEBHOOK_SECRET: undefined };
    expect((await deliver("{}")).status).toBe(503);
  });

  it("refuses a missing, wrong or stale signature", async () => {
    const body = event({ id: "pi_TEST1234567890" });
    expect((await deliver(body, "")).status).toBe(401);
    expect((await deliver(body, "t=1,v1=00")).status).toBe(401);
    expect((await deliver(body, await signed(body, Math.floor(Date.now() / 1000) - 3600))).status).toBe(401);
  });

  it("refuses a body that is not JSON, and a success with no intent id", async () => {
    expect((await deliver("not json")).status).toBe(400);
    expect((await deliver(event({ id: "nope" }))).status).toBe(400);
  });

  it("acknowledges other events and other payments without touching Stripe", async () => {
    expect((await deliver(event({ id: "pi_TEST1234567890" }, "charge.refunded"))).status).toBe(200);
    expect((await deliver(event({ id: "pi_TEST1234567890", amount: 5000, currency: "usd", metadata: {} }))).status).toBe(200);
    expect(fetched).toEqual([]);
  });
});
