import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEmail, FakeKV, FakeStore, fakeLock } from "./fakes";
import { forgetToken } from "@/lib/gcal";
import { bookingToken, manageLinks, tokenOpens } from "@/lib/booking-token";
import { BookingLock } from "@/worker/booking-lock";

/* Reschedule and cancel (`app/api/booking/[id]`): the mail's signed link
   opens one booking until a day after it; a cancel 48 hours or more ahead
   refunds the deposit, under that it does not; a move patches the event
   and mails a new confirmation. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env, ctx: { waitUntil: (p: Promise<unknown>) => p } }) }));
const { POST: book } = await import("@/app/api/book/route");
const { POST: change } = await import("@/app/api/booking/[id]/route");
const { settle } = await import("@/lib/deposit");

const SECRET = "booking-secret-for-tests";
const OAUTH = JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" });
/** A Wednesday 10 AM Pacific at least `days` out. */
const wednesday = (days: number) => {
  const d = new Date(Date.now() + days * 864e5);
  d.setUTCDate(d.getUTCDate() + ((3 - d.getUTCDay() + 7) % 7));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 18)).toISOString();
};
const plus = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * 36e5).toISOString();

let busy: { start: string; end: string; id: string }[];
let calls: { method: string; url: string; body?: { start: { dateTime: string }; end: { dateTime: string } } }[];
let refundOk: boolean;
let client: FakeEmail;
let mail: FakeEmail;

beforeEach(() => {
  forgetToken();
  busy = [];
  calls = [];
  refundOk = true;
  client = new FakeEmail();
  mail = new FakeEmail();
  ctx.env = {
    GCAL_OAUTH: OAUTH,
    BOOKING_SECRET: SECRET,
    BOOKING_LOCK: fakeLock(new BookingLock({ storage: new FakeStore() }, { GCAL_OAUTH: OAUTH })),
    INBOX: new FakeKV(),
    CLIENT_EMAIL: client,
    EMAIL: mail,
    STRIPE_SECRET_KEY: "sk_test_x",
    DEPOSIT_LIMIT: { limit: async () => ({ success: true }) },
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    const method = init?.method ?? "GET";
    const body = init?.body && !url.startsWith("https://api.stripe.com") ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (url.includes("/freeBusy")) return Response.json({ calendars: { primary: { busy } } });
    const ev = /\/events\/([^?]+)/.exec(url)?.[1];
    if (method === "POST" && url.includes("/events")) {
      busy.push({ start: body.start.dateTime, end: body.end.dateTime, id: `ev${busy.length}` });
      return Response.json({ id: busy.at(-1)!.id });
    }
    if (method === "PATCH" && ev) {
      Object.assign(busy.find((x) => x.id === ev)!, { start: body.start.dateTime, end: body.end.dateTime });
      return Response.json({ id: ev });
    }
    if (method === "DELETE" && ev) {
      busy = busy.filter((x) => x.id !== ev);
      return new Response(null, { status: 204 });
    }
    if (url.endsWith("/refunds")) return refundOk ? Response.json({ id: "re_1" }) : Response.json({ error: {} }, { status: 500 });
    if (url.startsWith("https://api.stripe.com")) return Response.json({ id: "x", status: "succeeded" });
    return Response.json({}, { status: 404 });
  });
});

/** A paid portraits session through the webhook; its id and token from the client's mail. */
async function paid(start: string) {
  const meta = { kind: "deposit", engine: "own", slug: "portraits", start, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com" };
  expect(await settle(ctx.env as never, "pi_TEST1234567890", meta)).toBe("booked");
  const link = String(client.sent.at(-1)!.text).match(/\/booking\/(\w+)\?t=([\w.-]+)&do=cancel/)!;
  return { id: link[1], t: link[2] };
}
const post = (id: string, body: unknown) =>
  change(new Request(`https://juliangigola.com/api/booking/${id}`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

describe("the link", () => {
  it("opens its own booking until a day after it, and nothing else", async () => {
    const t = await bookingToken(SECRET, "abc", Date.now() + 864e5);
    expect(await tokenOpens(SECRET, "abc", t)).toBe(true);
    expect(await tokenOpens(SECRET, "abd", t)).toBe(false);
    expect(await tokenOpens("other", "abc", t)).toBe(false);
    expect(await tokenOpens(undefined, "abc", t)).toBe(false);
    expect(await tokenOpens(SECRET, "abc", t.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBe(false);
    expect(await tokenOpens(SECRET, "abc", await bookingToken(SECRET, "abc", Date.now() - 1000))).toBe(false);
    expect(await manageLinks(undefined, { id: "abc", start: new Date().toISOString() })).toBeNull();
  });

  it("is in the client's mail, with the 48-hour rule, and refused when wrong", async () => {
    const { id } = await paid(wednesday(7));
    expect(String(client.sent[0].html)).toContain("https://juliangigola.com/booking/");
    expect(String(client.sent[0].text)).toContain("48 hours or more before");
    expect(String(client.sent[0].html)).not.toContain("cal.com");
    expect((await post(id, { t: "1.x", action: "cancel" })).status).toBe(401);
  });
});

describe("cancel", () => {
  it("48 hours or more ahead: off the calendar, deposit refunded, both told", async () => {
    const { id, t } = await paid(wednesday(7));
    const res = await post(id, { t, action: "cancel" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ refunded: true, record: { cancelled: true, paid: true } });
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("sendUpdates=none"))).toBe(true);
    expect(calls.filter((c) => c.url.endsWith("/refunds"))).toHaveLength(1);
    expect(mail.sent.at(-1)!.subject).toMatch(/^Cancelled: /);
    expect(String(client.sent.at(-1)!.text)).toContain("refunded to your card");
    // A second click does nothing more.
    expect((await post(id, { t, action: "cancel" })).status).toBe(409);
    expect(calls.filter((c) => c.url.endsWith("/refunds"))).toHaveLength(1);
  });

  it("under 48 hours: cancelled, deposit kept", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(start) - 47 * 36e5);
    const res = await post(id, { t, action: "cancel" });
    vi.useRealTimers();
    expect(await res.json()).toMatchObject({ refunded: null, record: { cancelled: true } });
    expect(calls.some((c) => c.url.endsWith("/refunds"))).toBe(false);
    expect(String(client.sent.at(-1)!.text)).toContain("not refunded");
  });

  it("judges the refund by the time first booked: moved out, then cancelled, keeps the deposit", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(start) - 24 * 36e5);
    expect((await post(id, { t, action: "reschedule", start: plus(start, 7 * 24) })).status).toBe(200);
    // The move says so: to the client and to hello@.
    expect(String(client.sent.at(-1)!.text)).toContain("no longer refundable");
    expect(String(mail.sent.at(-1)!.text)).toContain("no longer refundable");
    const res = await post(id, { t, action: "cancel" });
    vi.useRealTimers();
    expect(await res.json()).toMatchObject({ refunded: null, record: { cancelled: true, firstStart: start } });
    expect(calls.some((c) => c.url.endsWith("/refunds"))).toBe(false);
    expect(String(client.sent.at(-1)!.text)).toContain("not refunded");
  });

  it("tells hello@ when the refund fails", async () => {
    const { id, t } = await paid(wednesday(7));
    refundOk = false;
    expect(await (await post(id, { t, action: "cancel" })).json()).toMatchObject({ refunded: false });
    expect(String(mail.sent.at(-1)!.text)).toContain("refund it by hand");
  });

  it("a free call cancels with no money", async () => {
    const res = await book(new Request("https://juliangigola.com/api/book", { method: "POST", body: JSON.stringify({ slug: "music-call", start: wednesday(7), timeZone: "America/Los_Angeles", name: "QA", email: "qa@example.com", via: "Phone" }) }));
    const { data } = await res.json();
    const t = String(client.sent[0].text).match(/t=([\w.-]+)&do=cancel/)![1];
    expect(await (await post(data.uid, { t, action: "cancel" })).json()).toMatchObject({ refunded: null, record: { paid: false } });
  });
});

describe("reschedule", () => {
  it("moves the event, keeps the deposit, mails a new confirmation", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    const res = await post(id, { t, action: "reschedule", start: plus(start, 2) });
    expect(res.status).toBe(200);
    expect((await res.json()).record).toMatchObject({ start: plus(start, 2), cancelled: false });
    expect(calls.some((c) => c.method === "PATCH" && c.url.includes("sendUpdates=none"))).toBe(true);
    expect(calls.some((c) => c.url.endsWith("/refunds"))).toBe(false);
    expect(mail.sent.at(-1)!.subject).toMatch(/^Rescheduled: /);
    expect(client.sent).toHaveLength(2);
    // Moved a week ahead of the first date: still refundable, by the first date.
    expect(String(client.sent[1].text)).toContain("before the time you first booked");
  });

  it("is not blocked by its own old time, only by another booking", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    busy.push({ start: plus(start, 3), end: plus(start, 4), id: "other" });
    expect((await post(id, { t, action: "reschedule", start: plus(start, 3) })).status).toBe(409);
    // One hour on: its own 10 to 11 plus buffer would be in the way if it were not its own.
    expect((await post(id, { t, action: "reschedule", start: plus(start, 1) })).status).toBe(200);
  });
});
