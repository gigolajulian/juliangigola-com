import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeKV, reply } from "./fakes";

/* The $100 deposit (`lib/deposit.ts`): the intent is created only for an
   open time at a fixed amount, Stripe's signed webhook books Cal.com or
   refunds, a second delivery does nothing, and the status read carries no
   personal data. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const { POST: start } = await import("@/app/api/deposit/route");
const { GET: status } = await import("@/app/api/deposit/[id]/route");
const { POST: hook } = await import("@/app/api/stripe/route");
const { bookingEnquiry, summary } = await import("@/lib/inbox");

const WHSEC = "whsec_test";
const PI = "pi_TEST1234567890";
const START = new Date(Math.ceil((Date.now() + 7 * 864e5) / 36e5) * 36e5).toISOString();
const BODY = { slug: "portraits", start: START, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com", phone: "+14085550100", where: "Studio", amount: 1 };

type Call = { url: string; init?: RequestInit };
let calls: Call[];
let open: boolean;
let calOk: boolean;
let refundOk: boolean;
type Mail = { subject: string; text: string; replyTo?: { email: string } };
let mails: Mail[];
/** The intent as Stripe holds it: the webhook writes its outcome here. */
let intent: { amount: number; currency: string; metadata: Record<string, string> };

beforeEach(() => {
  calls = [];
  open = true;
  calOk = true;
  refundOk = true;
  intent = { amount: 10000, currency: "usd", metadata: { kind: "deposit" } };
  mails = [];
  ctx.env = { INBOX: new FakeKV(), STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: WHSEC, EMAIL: { send: async (m: Mail) => void mails.push(m) } };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.includes("/v2/slots")) return reply({ status: "success", data: { day: open ? [{ start: START }] : [] } });
    if (url.includes("/v2/bookings")) return calOk ? reply({ status: "success", data: { uid: "cal_uid", start: START } }) : reply({ status: "error" }, 400);
    if (url.endsWith("/payment_intents")) return reply({ id: PI, client_secret: `${PI}_secret_x` });
    if (url.endsWith(`/payment_intents/${PI}`)) {
      if (init?.method === "POST") for (const [k, v] of new URLSearchParams(String(init.body))) intent.metadata[k.slice(9, -1)] = v;
      return reply({ id: PI, ...intent });
    }
    if (url.endsWith("/refunds")) return refundOk ? reply({ id: "re_1" }) : reply({ error: {} }, 500);
    throw new Error(`unexpected fetch ${url}`);
  });
});

const kv = () => ctx.env.INBOX as FakeKV;
const post = (body: unknown) => start(new Request("https://juliangigola.com/api/deposit", { method: "POST", body: JSON.stringify(body) }));
const read = (id: string) => status(new Request(`https://juliangigola.com/api/deposit/${id}`), { params: Promise.resolve({ id }) });

async function signed(body: string, at = Math.floor(Date.now() / 1000), secret = WHSEC) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${at}.${body}`));
  return `t=${at},v1=${[...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
const paid = (metadata: Record<string, string> = { kind: "deposit", slug: "portraits", start: START, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com", where: "Studio" }, amount = 10000) =>
  JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: PI, amount, currency: "usd", metadata } } });
const deliver = async (body: string, sig?: string) =>
  hook(new Request("https://juliangigola.com/api/stripe", { method: "POST", body, headers: { "stripe-signature": sig ?? (await signed(body)) } }));

describe("POST /api/deposit", () => {
  it("is off while the Stripe key is unset", async () => {
    delete ctx.env.STRIPE_SECRET_KEY;
    expect((await post(BODY)).status).toBe(503);
  });

  it("refuses a session that takes no deposit, a past time and a bad email", async () => {
    expect((await post({ ...BODY, slug: "music-call" })).status).toBe(400);
    expect((await post({ ...BODY, start: "2020-01-01T00:00:00Z" })).status).toBe(400);
    expect((await post({ ...BODY, email: "nope" })).status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("answers 409 when the time is gone, without creating an intent", async () => {
    open = false;
    const res = await post(BODY);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "taken" });
    expect(calls.some((c) => c.url.includes("stripe"))).toBe(false);
  });

  it("creates a $100 intent whatever amount was sent, with the booking in its metadata", async () => {
    const res = await post(BODY);
    expect(await res.json()).toEqual({ clientSecret: `${PI}_secret_x`, intentId: PI, amount: 10000, currency: "usd" });
    const form = new URLSearchParams(String(calls.find((c) => c.url.endsWith("/payment_intents"))!.init!.body));
    expect(form.get("amount")).toBe("10000");
    expect(form.getAll("payment_method_types[]")).toEqual(["card"]);
    expect(form.get("metadata[slug]")).toBe("portraits");
    expect(form.get("metadata[start]")).toBe(START);
    expect(form.get("metadata[amount]")).toBeNull();
    expect(form.get("metadata[kind]")).toBe("deposit");
    expect(kv().puts).toEqual([]);
  });
});

describe("POST /api/stripe", () => {
  it("refuses everything while a secret is unset", async () => {
    delete ctx.env.STRIPE_WEBHOOK_SECRET;
    expect((await deliver(paid())).status).toBe(503);
  });

  it("refuses a wrong, missing or old signature", async () => {
    const body = paid();
    expect((await deliver(body, await signed(body, undefined, "whsec_other"))).status).toBe(401);
    expect((await deliver(body, "nothing")).status).toBe(401);
    expect((await deliver(body, await signed(body, Math.floor(Date.now() / 1000) - 600))).status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("ignores other events", async () => {
    expect((await deliver(JSON.stringify({ type: "payment_intent.created", data: { object: { id: PI } } }))).status).toBe(200);
    expect(calls).toEqual([]);
  });

  it("leaves every other payment on the account alone", async () => {
    // Cal.com's own $100 charge, an invoice, a deposit-shaped intent at another amount.
    for (const body of [paid({}), paid({ slug: "portraits", start: START }), paid(undefined, 25000)]) {
      expect((await deliver(body)).status).toBe(200);
    }
    expect(calls).toEqual([]);
    expect(kv().puts).toEqual([]);
  });

  it("books Cal.com on payment, once, however often Stripe delivers", async () => {
    expect((await deliver(paid())).status).toBe(200);
    expect((await deliver(paid())).status).toBe(200);
    expect(calls.filter((c) => c.url.includes("/v2/bookings"))).toHaveLength(1);
    expect(kv().json(`deposit:${PI}`)).toMatchObject({ status: "booked", booking: { uid: "cal_uid" } });
  });

  it("refunds when the time went while they paid", async () => {
    open = false;
    await deliver(paid());
    const refund = calls.find((c) => c.url.endsWith("/refunds"))!;
    expect(new URLSearchParams(String(refund.init!.body)).get("payment_intent")).toBe(PI);
    expect((refund.init!.headers as Record<string, string>)["Idempotency-Key"]).toBe(`refund-${PI}`);
    expect(kv().json(`deposit:${PI}`).status).toBe("refunded");
  });

  it("refunds when Cal.com refuses the booking", async () => {
    calOk = false;
    await deliver(paid());
    expect(kv().json(`deposit:${PI}`).status).toBe("refunded");
  });

  it("tells the Inbox when even the refund fails", async () => {
    calOk = false;
    refundOk = false;
    await deliver(paid());
    expect(kv().json(`deposit:${PI}`).status).toBe("failed");
    const row = kv().puts.find((k) => !k.startsWith("deposit:"))!;
    expect(kv().json(row)).toMatchObject({ type: "booking", email: "qa@example.com" });
  });
});

describe("telling Julian", () => {
  const LINK = `https://dashboard.stripe.com/test/payments/${PI}`;

  it("mails hello@ when a deposit books, and puts the Stripe link in the Cal.com notes", async () => {
    await deliver(paid());
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toMatch(/^Deposit paid: Portraits, .+, QA Test, \$100$/);
    expect(mails[0].text).toContain(LINK);
    expect(mails[0].replyTo?.email).toBe("qa@example.com");
    const cal = JSON.parse(String(calls.find((c) => c.url.includes("/v2/bookings"))!.init!.body));
    expect(cal.bookingFieldsResponses.notes).toContain(`Deposit paid on the site: $100. Stripe: ${LINK}`);
  });

  it("mails a refund, and a deposit stuck paid", async () => {
    open = false;
    await deliver(paid());
    expect(mails.map((m) => m.subject.split(":")[0])).toEqual(["Deposit refunded"]);
    ctx.env.INBOX = new FakeKV();
    refundOk = false;
    await deliver(paid());
    expect(mails[1].subject).toMatch(/^Deposit paid, not booked, not refunded: /);
  });

  it("keeps the booking when the mail fails", async () => {
    ctx.env.EMAIL = { send: async () => { throw new Error("quota"); } };
    expect((await deliver(paid())).status).toBe(200);
    expect(kv().json(`deposit:${PI}`).status).toBe("booked");
  });

  it("marks the booking's Inbox row as paid from the Cal.com notes", () => {
    const row = bookingEnquiry({ type: "portraits", attendees: [{ name: "QA Test", email: "qa@example.com" }], additionalNotes: `Deposit paid on the site: $100. Stripe: ${LINK}` }, 0, "id");
    expect(row.deposit).toBe(LINK);
    expect(summary(row).deposit).toBe(LINK);
    expect(bookingEnquiry({ additionalNotes: "No deposit here." }, 0, "id").deposit).toBeUndefined();
  });
});

describe("GET /api/deposit/<id>", () => {
  it("answers 404 to anything that is not an intent id", async () => {
    expect((await read("../INBOX")).status).toBe(404);
  });

  it("is pending until the webhook has run, and while it runs", async () => {
    expect(await (await read(PI)).json()).toEqual({ status: "pending" });
    await kv().put(`deposit:${PI}`, JSON.stringify({ status: "booking", at: "" }));
    expect(await (await read(PI)).json()).toEqual({ status: "pending" });
  });

  it("reads the outcome from Stripe, not KV, so another location sees it at once", async () => {
    await deliver(paid());
    ctx.env.INBOX = new FakeKV();
    expect((await (await read(PI)).json()).status).toBe("booked");
  });

  it("answers 404 to an intent that is not a deposit, or that Stripe does not have", async () => {
    intent.metadata = {};
    expect((await read(PI)).status).toBe(404);
    vi.stubGlobal("fetch", async () => reply({ error: { code: "resource_missing" } }, 404));
    expect((await read("pi_MADEUP12345678")).status).toBe(404);
  });

  it("keeps the booking when the copy to Stripe fails", async () => {
    const real = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) =>
      url.endsWith(`/payment_intents/${PI}`) ? reply({ error: {} }, 500) : real(url, init));
    await deliver(paid());
    expect(kv().json(`deposit:${PI}`).status).toBe("booked");
    expect(calls.some((c) => c.url.endsWith("/refunds"))).toBe(false);
  });

  it("reports the booking without who made it", async () => {
    await deliver(paid());
    const out = await (await read(PI)).json();
    expect(out).toEqual({ status: "booked", booking: { uid: "cal_uid", start: START } });
  });
});
