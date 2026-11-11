import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/stripe/route";
import { FakeKV, LEADS_KEY } from "./fakes";
import { readLog } from "@/lib/leads/activity-log";
import { sealer } from "@/lib/leads/lead-crypto";
const logOf = async (kv: unknown, email: string) => { const s = (await sealer(LEADS_KEY))!; return readLog(kv as never, s, await s.id(email)); };


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
    expect((await deliver(event({ id: "pi_TEST1234567890" }, "charge.dispute.created"))).status).toBe(200);
    expect((await deliver(event({ id: "pi_TEST1234567890", amount: 5000, currency: "usd", metadata: {} }))).status).toBe(200);
    expect(fetched).toEqual([]);
  });

  it("logs another payment on the payer, through the charge when the intent has no address, and never a proof payment", async () => {
    const kv = new FakeKV();
    ctx.env = { ...ctx.env, INBOX: kv, LEADS_KEY };
    vi.stubGlobal("fetch", async (u: string) => (fetched.push(u), Response.json({ billing_details: { email: "pay@example.com" } })));
    await deliver(event({ id: "pi_TEST1234567891", amount: 120000, amount_received: 120000, currency: "usd", receipt_email: "a@example.com", description: "Invoice 1126", metadata: {} }));
    await deliver(event({ id: "pi_TEST1234567892", amount: 5000, currency: "usd", latest_charge: "ch_1", metadata: {} }));
    await deliver(event({ id: "pi_TEST1234567893", amount: 1500, currency: "usd", receipt_email: "a@example.com", metadata: { proof: "AbCd" } }));
    expect((await logOf(kv, "a@example.com")).map((e) => [e.kind, e.amount])).toEqual([["payment", 1200]]);
    expect((await logOf(kv, "pay@example.com")).map((e) => [e.kind, e.amount])).toEqual([["payment", 50]]);
    expect(fetched).toEqual(["https://api.stripe.com/v1/charges/ch_1"]);
  });

  it("logs a refund made in the dashboard once, however often Stripe delivers it", async () => {
    const kv = new FakeKV();
    ctx.env = { ...ctx.env, INBOX: kv, LEADS_KEY };
    const charge = { id: "ch_2", payment_intent: "pi_TEST1234567894", amount: 10000, amount_refunded: 10000, receipt_email: "r@example.com", refunds: { data: [{ amount: 10000 }] } };
    await deliver(event(charge, "charge.refunded"));
    await deliver(event(charge, "charge.refunded"));
    expect((await logOf(kv, "r@example.com")).map((e) => [e.kind, e.amount, e.ref])).toEqual([["refund", 100, "refund-pi_TEST1234567894"]]);
  });
});
