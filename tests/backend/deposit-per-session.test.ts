import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEmail, FakeKV, FakeStore, fakeLock, LEADS_KEY, leadOf, GOOGLE_OAUTH as OAUTH } from "./fakes";
import { forgetToken } from "@/lib/booking/gcal";
import { clientView, depositPaid } from "@/lib/booking/engine";
import { DEPOSIT, depositFor, PAID } from "@/lib/booking/paid";
import { amountOf, isDeposit } from "@/lib/booking/deposit";
import { BOOK_ROWS } from "@/lib/home/data";
import { priceLabel, SESSIONS } from "@/lib/photos-and-sessions";
import { BookingLock } from "@/worker/booking-lock";

// Pinned clock, as in manage-booking.test.ts: hours and the 48h window must not depend on the day.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-11-11T20:00:00Z"));

/* The deposit by session (Julian, 2026-11-15 and 11-16): Portraits $250,
   Headshots and Graduation $200, Studio digitals $150, Model test $100. Through the real routes with Stripe and
   Google mocked: the intent's amount comes from the slug, the webhook
   books it, every mail and log says what was paid, and a cancel returns it. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("./fakes")).cloudflareMock(ctx, (p) => p));
const { POST: start } = await import("@/app/api/deposit/route");
const { POST: hook } = await import("@/app/api/stripe/route");
const { POST: change } = await import("@/app/api/booking/[id]/route");

const WHSEC = "whsec_test";
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
    ["portraits", 25000],
    ["graduation", 20000],
    ["model-test", 10000],
  ])("%s creates a %i cent intent, whatever amount the request names", async (slug, cents) => {
    const res = await open(slug);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ intentId: PI, amount: cents, currency: "usd" });
    expect(stripeCalls.find((c) => c.url.endsWith("/payment_intents"))!.form.get("amount")).toBe(String(cents));
  });

  it("names the session and the person on the payment in Stripe", async () => {
    await open("headshots");
    const form = stripeCalls.find((c) => c.url.endsWith("/payment_intents"))!.form;
    // The clock is pinned to Nov 11, 2026, noon Pacific; the session is a week on.
    expect(form.get("description")).toMatch(/^Headshots deposit: QA Test\. Session Wed, Nov 18, .+\. Booked Nov 11, 2026\.$/);
    expect([form.get("metadata[name]"), form.get("metadata[slug]")]).toEqual(["QA Test", "headshots"]);
  });

  it("has a figure for every paid slug, and refuses any other", () => {
    for (const slug of PAID) expect(amountOf(slug)).toBe(DEPOSIT[slug] * 100);
    expect(() => amountOf("studio-digitals")).toThrow();
    expect(() => amountOf("wedding-call")).toThrow();
  });

  it("takes any session's amount as a deposit, and no other", () => {
    const pi = (amount: number) => ({ amount, currency: "usd", metadata: { kind: "deposit" } });
    expect([10000, 15000, 20000, 25000].every((a) => isDeposit(pi(a)))).toBe(true);
    expect(isDeposit(pi(5000))).toBe(false);
    expect(isDeposit({ ...pi(20000), metadata: {} })).toBe(false);
  });
});

describe.each([
  ["portraits", 250],
  ["headshots", 200],
  ["graduation", 200],
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
    // A week ahead: 90% of what was paid goes back, 10% is the booking fee.
    const refund = stripeCalls.find((c) => c.url.endsWith("/refunds"))!;
    expect(refund.form.get("payment_intent")).toBe(PI);
    expect(refund.form.get("amount")).toBe(String(usd * 90));
    expect(String(client.sent.at(-1)!.text)).toContain(`$${usd * 0.9} of your $${usd} deposit is refunded to your card. $${usd * 0.1} is kept as the booking fee.`);
    expect(await money()).toEqual([["payment", usd], ["refund", usd * 0.9]]);
  });
});

describe("what was paid, not today's price", () => {
  it("books a Headshots intent made at the old $100, and returns 90% of $100", async () => {
    expect((await pay("headshots", 10000)).status).toBe(200);
    expect(String(client.sent.at(-1)!.text)).toContain("Deposit paid: $100.00");
    await cancel();
    expect(String(client.sent.at(-1)!.text)).toContain("$90 of your $100 deposit is refunded to your card.");
    expect(await money()).toEqual([["payment", 100], ["refund", 90]]);
  });

  it("reads a record from before amounts were stored as $100", () => {
    expect(depositPaid({ intent: PI })).toBe(100);
    expect(depositPaid({ intent: PI, deposit: 200 })).toBe(200);
    expect(depositPaid({})).toBeUndefined();
    expect(clientView({ id: "a", slug: "headshots", session: "Headshots", start: WHEN, end: WHEN, intent: PI } as never)).toMatchObject({ paid: true, deposit: 100 });
  });
});

describe("the screens read the same map", () => {
  it("prints each session's /book price on the home rows, and its deposit on the line under Book", () => {
    // the rows show what /book shows (priceLabel): "From" where there is a price, the deposit where the price is quoted after
    expect(Object.fromEntries(BOOK_ROWS.map((r) => [r.slug, r.price]))).toEqual({ portraits: "$250 deposit", headshots: "From $400", graduation: "From $400", "studio-digitals": "From $300" });
    expect(Object.fromEntries(BOOK_ROWS.map((r) => [r.slug, r.dep]))).toEqual({ portraits: "$250", headshots: "$200", graduation: "$200", "studio-digitals": "$150" });
    // Every paid session's Cal.com slug is one the map knows: "studio-digitals" must never fall through to $100.
    for (const s of Object.values(SESSIONS).filter((x) => x.paid)) expect(PAID).toContain(s.cal!.split("/")[1]);
    expect(priceLabel({ ...SESSIONS["studio-digitals"], from: null })).toBe("$150 deposit");
    expect(priceLabel({ ...SESSIONS.headshots, from: null })).toBe("$200 deposit");
    expect(depositFor("digitals")).toBe(150);
  });
});

describe("a cancel between 48 and 24 hours ahead", () => {
  it("returns 70% of what was paid, and Stripe's own refund event is not logged twice", async () => {
    expect((await open("headshots")).status).toBe(200);
    expect((await pay("headshots", 20000)).status).toBe(200);
    vi.setSystemTime(Date.parse(WHEN) - 30 * 36e5);
    const res = await cancel();
    expect(await res.json()).toMatchObject({ refunded: true, back: 140 });
    const refund = stripeCalls.find((c) => c.url.endsWith("/refunds"))!;
    expect(refund.form.get("amount")).toBe("14000");
    expect(String(client.sent.at(-1)!.text)).toContain("$140 of your $200 deposit is refunded to your card and $60 is kept");

    // Stripe then reports the same refund: `charge.refunded`, keyed by the cents refunded so far.
    const raw = JSON.stringify({ type: "charge.refunded", data: { object: { id: "ch_1", payment_intent: PI, amount: 20000, amount_refunded: 14000, receipt_email: "qa@example.com", refunds: { data: [{ amount: 14000 }] } } } });
    const at = Math.floor(Date.now() / 1000);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WHSEC), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${at}.${raw}`)))].map((b) => b.toString(16).padStart(2, "0")).join("");
    expect((await hook(new Request("https://juliangigola.com/api/stripe", { method: "POST", body: raw, headers: { "stripe-signature": `t=${at},v1=${sig}` } }))).status).toBe(200);
    vi.setSystemTime(new Date("2026-11-11T20:00:00Z"));
    expect(await money()).toEqual([["payment", 200], ["refund", 140]]);
  });
});
