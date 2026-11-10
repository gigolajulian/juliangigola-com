import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/deposit/route";
import { FakeKV, reply } from "./fakes";

/* /api/deposit: off without Stripe, rate limited, refuses a bad booking,
   and creates a fixed $100 intent for an open time. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const PI = "pi_TEST1234567890";
const START = new Date(Math.ceil((Date.now() + 7 * 864e5) / 36e5) * 36e5).toISOString();
const BODY = { slug: "portraits", start: START, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com", phone: "+14085550100", where: "Studio", amount: 1 };
const post = (body: unknown) => POST(new Request("https://juliangigola.com/api/deposit", { method: "POST", body: JSON.stringify(body) }));

let allowed: boolean;
let intents: string[];
beforeEach(() => {
  allowed = true;
  intents = [];
  ctx.env = { INBOX: new FakeKV(), DEPOSIT_LIMIT: { limit: async () => ({ success: allowed }) }, STRIPE_SECRET_KEY: "sk_test_x" };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("/v2/slots")) return reply({ status: "success", data: { day: [{ start: START }] } });
    if (url.endsWith("/payment_intents")) {
      intents.push(String(init?.body));
      return reply({ id: PI, client_secret: `${PI}_secret_x` });
    }
    return reply({}, 404);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/deposit", () => {
  it("is off without STRIPE_SECRET_KEY", async () => {
    ctx.env = { ...ctx.env, STRIPE_SECRET_KEY: undefined };
    expect((await post(BODY)).status).toBe(503);
  });

  it("is rate limited", async () => {
    allowed = false;
    expect((await post(BODY)).status).toBe(429);
    expect(intents).toEqual([]);
  });

  it("refuses a booking that does not parse", async () => {
    expect((await post({ ...BODY, slug: "nope" })).status).toBe(400);
    expect((await post(null)).status).toBe(400);
    expect(intents).toEqual([]);
  });

  it("creates an intent for $100 whatever amount was asked", async () => {
    const res = await post(BODY);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ clientSecret: `${PI}_secret_x`, intentId: PI, amount: 10000, currency: "usd" });
    expect(new URLSearchParams(intents[0]).get("amount")).toBe("10000");
  });
});
