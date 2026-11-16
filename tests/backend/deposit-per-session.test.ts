import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEmail, FakeKV, FakeStore, fakeLock, LEADS_KEY, leadOf } from "./fakes";
import { forgetToken } from "@/lib/booking/gcal";
import { clientView, depositPaid } from "@/lib/booking/booking-engine";
import { DEPOSIT, depositFor, PAID } from "@/lib/booking/paid";
import { amountOf, isDeposit } from "@/lib/booking/deposit";
import { BOOK_ROWS } from "@/components/v3/mt/data";
import { rate, SESSIONS } from "@/lib/v3";
import { BookingLock } from "@/worker/booking-lock";

// Pinned clock, as in manage-booking.test.ts: hours and the 48h window must not depend on the day.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-11-11T20:00:00Z"));

/* The deposit by session (Julian, 2026-11-15): Headshots $200, Studio
   digitals $150, the rest $100. Through the real routes with Stripe and
   Google mocked: the intent's amount comes from the slug, the webhook
   books it, every mail and log says what was paid, and a cancel returns it. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env, ctx: { waitUntil: (p: Promise<unknown>) => p } }) }));
const { POST: start } = await import("@/app/api/deposit/route");
const { POST: hook } = await import("@/app/api/stripe/route");
const { POST: change } = await import("@/app/api/booking/[id]/route");

const WHSEC = "whsec_test";
const OAUTH = JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" });
const PI = "pi_TEST1234567890";
// A Wednesday 10 AM Pacific, a week out.
const WHEN = "2026-11-18T18:00:00.000Z";

let busy: { start: string; end: string; id: string }[];
let stripeCalls: { url: string; form: URLSearchParams }[];
let events: { description: string }[];
let client: FakeEmail;
let mail: FakeEmail;

beforeEach(() => {
  forgetToken();
  busy = [];
  stripeCalls = [];
  events = [];
  client = new FakeEmail();
  mail = new FakeEmail();
  ctx.env = {
    GCAL_OAUTH: OAUTH,
    BOOKING_SECRET: "booking-secret-for-tests",
    BOOKING_LOCK: fakeLock(new BookingLock({ storage: new FakeStore() }, { GCAL_OAUTH: OAUTH })),
    INBOX: new FakeKV(),
    LEADS_KEY,
    CLIENT_EMAIL: client,
    EMAIL: mail,
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: WHSEC,
    DEPOSIT_LIMIT: { limit: async () => ({ success: true }) },
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    const method = init?.method ?? "GET";
    if (url.startsWith("https://api.stripe.com")) {
      stripeCalls.push({ url, form: new URLSearchParams(String(init?.body ?? "")) });
      return Response.json(url.endsWith("/payment_intents") ? { id: PI, client_secret: `${PI}_secret_x` } : { id: "x", status: "succeeded" });
    }
    if (url.includes("/freeBusy")) return Response.json({ calendars: { primary: { busy } } });
    if (method === "POST" && url.includes("/events")) {
      const body = JSON.parse(String(init!.body));
      events.push(body);
      busy.push({ start: body.start.dateTime, end: body.end.dateTime, id: `ev${busy.length}` });
      return Response.json({ id: busy.at(-1)!.id });
    }
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (method === "PATCH") return Response.json({ id: "ev0" });
    if (url.includes("/events")) return Response.json({ items: [] });
    return Response.json({}, { status: 404 });
  });
});

const body = (slug: string) => ({ slug, start: WHEN, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com", phone: "+14085550100", where: "Studio", amount: 1 });
const open = (slug: string) => start(new Request("https://juliangigola.com/api/deposit", { method: "POST", body: JSON.stringify(body(slug)) }));

/** Stripe's signed `payment_intent.succeeded` for the intent the site just made, at `cents`. */
async function pay(slug: string, cents: number) {
  const metadata = { kind: "deposit", engine: "own", slug, start: WHEN, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com" };
  const raw = JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: PI, amount: cents, amount_received: cents, currency: "usd", metadata } } });
  const at = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WHSEC), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${at}.${raw}`)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hook(new Request("https://juliangigola.com/api/stripe", { method: "POST", body: raw, headers: { "stripe-signature": `t=${at},v1=${sig}` } }));
}

/** A change through the client's own link, a week ahead: refundable. */
async function act(body: { action: "cancel" } | { action: "reschedule"; start: string }) {
  const [, id, t] = String(client.sent.at(-1)!.text).match(/\/booking\/(\w+)\?t=([\w.-]+)&do=cancel/)!;
  return change(new Request(`https://juliangigola.com/api/booking/${id}`, { method: "POST", body: JSON.stringify({ t, ...body }) }), { params: Promise.resolve({ id }) });
}
const cancel = () => act({ action: "cancel" });
const money = async () => (await leadOf(ctx.env.INBOX as FakeKV, "qa@example.com"))!.events.filter((e) => e.kind === "payment" || e.kind === "refund").map((e) => [e.kind, e.amount]);

describe("the amount is the session's, set on the server", () => {
  it.each([
    ["headshots", 20000],
    ["digitals", 15000],
    ["portraits", 10000],
    ["graduation", 10000],
    ["model-test", 10000],
  ])("%s creates a %i cent intent, whatever amount the request names", async (slug, cents) => {
    const res = await open(slug);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ intentId: PI, amount: cents, currency: "usd" });
    expect(stripeCalls.find((c) => c.url.endsWith("/payment_intents"))!.form.get("amount")).toBe(String(cents));
  });

  it("has a figure for every paid slug, and refuses any other", () => {
    for (const slug of PAID) expect(amountOf(slug)).toBe(DEPOSIT[slug] * 100);
    expect(() => amountOf("studio-digitals")).toThrow();
    expect(() => amountOf("wedding-call")).toThrow();
  });

  it("takes any session's amount as a deposit, and no other", () => {
    const pi = (amount: number) => ({ amount, currency: "usd", metadata: { kind: "deposit" } });
    expect([10000, 15000, 20000].every((a) => isDeposit(pi(a)))).toBe(true);
    expect(isDeposit(pi(5000))).toBe(false);
    expect(isDeposit({ ...pi(20000), metadata: {} })).toBe(false);
  });
});

describe.each([
  ["headshots", 200],
  ["digitals", 150],
])("%s end to end at $%i", (slug, usd) => {
  it("books, says the figure everywhere, and a cancel returns it", async () => {
    expect((await open(slug)).status).toBe(200);
    expect((await pay(slug, usd * 100)).status).toBe(200);

    // The client's confirmation, hello@'s note, the calendar event and the lead's log.
    const confirm = client.sent.at(-1)!;
    expect(String(confirm.text)).toContain(`Deposit paid: $${usd}.00`);
    expect(String(confirm.html)).toContain(`$${usd}.00`);
    expect(String(confirm.html)).not.toContain("$100");
    expect(mail.sent.at(-1)!.subject).toMatch(new RegExp(`^Deposit paid: .*\\$${usd}$`));
    expect(events[0].description).toContain(`Deposit paid on the site: $${usd} (ref ${PI}).`);
    expect(await money()).toEqual([["payment", usd]]);

    // A move keeps what was paid: the new confirmation says the same figure.
    busy = [];
    expect((await act({ action: "reschedule", start: "2026-11-25T18:00:00.000Z" })).status).toBe(200);
    expect(String(client.sent.at(-1)!.text)).toContain(`Deposit paid: $${usd}.00`);

    const res = await cancel();
    expect(await res.json()).toMatchObject({ refunded: true, record: { cancelled: true, paid: true, deposit: usd } });
    // The whole charge goes back: the refund names the intent and no amount.
    const refund = stripeCalls.find((c) => c.url.endsWith("/refunds"))!;
    expect(refund.form.get("payment_intent")).toBe(PI);
    expect(refund.form.has("amount")).toBe(false);
    expect(String(client.sent.at(-1)!.text)).toContain(`Your $${usd} deposit is refunded to your card.`);
    expect(await money()).toEqual([["payment", usd], ["refund", usd]]);
  });
});

describe("what was paid, not today's price", () => {
  it("books a Headshots intent made at the old $100, and returns $100", async () => {
    expect((await pay("headshots", 10000)).status).toBe(200);
    expect(String(client.sent.at(-1)!.text)).toContain("Deposit paid: $100.00");
    await cancel();
    expect(String(client.sent.at(-1)!.text)).toContain("Your $100 deposit is refunded to your card.");
    expect(await money()).toEqual([["payment", 100], ["refund", 100]]);
  });

  it("reads a record from before amounts were stored as $100", () => {
    expect(depositPaid({ intent: PI })).toBe(100);
    expect(depositPaid({ intent: PI, deposit: 200 })).toBe(200);
    expect(depositPaid({})).toBeUndefined();
    expect(clientView({ id: "a", slug: "headshots", session: "Headshots", start: WHEN, end: WHEN, intent: PI } as never)).toMatchObject({ paid: true, deposit: 100 });
  });
});

describe("the screens read the same map", () => {
  it("prints each session's deposit on the home rows and the session index", () => {
    expect(Object.fromEntries(BOOK_ROWS.map((r) => [r.key, r.price]))).toEqual({ portraits: "$100 deposit", headshots: "$200 deposit", graduation: "$100 deposit", "studio-digitals": "$150 deposit" });
    // Every paid session's Cal.com slug is one the map knows: "studio-digitals" must never fall through to $100.
    for (const s of Object.values(SESSIONS).filter((x) => x.paid)) expect(PAID).toContain(s.cal!.split("/")[1]);
    expect(rate({ ...SESSIONS["studio-digitals"], from: null })).toBe("$150 deposit");
    expect(rate({ ...SESSIONS.headshots, from: null })).toBe("$200 deposit");
    expect(depositFor("digitals")).toBe(150);
  });
});
