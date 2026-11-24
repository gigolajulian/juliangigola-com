import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEmail, FakeKV, FakeStore, fakeLock, LEADS_KEY, leadOf, INBOX_KEY as KEY, GOOGLE_OAUTH as OAUTH } from "./fakes";
import { forgetToken } from "@/lib/google";
import { bookingToken, manageLinks, tokenOpens } from "@/lib/booking/token";
import { BookingLock } from "@/worker/booking-lock";
import { findBooking, saveBooking } from "@/lib/booking/engine";

// Pinned clock: weekday hours, DST and the 48h refund window must not depend on the day the suite runs.
vi.useFakeTimers({ toFake: ["Date"] });
const PIN = new Date("2026-11-11T20:00:00Z"); // a Wednesday, noon in San Jose
vi.setSystemTime(PIN);

/* Reschedule and cancel (`app/api/booking/[id]`): the mail's signed link
   opens one booking until a day after it; a cancel 48 hours or more ahead
   refunds the deposit, under that it does not; a move patches the event
   and mails a new confirmation. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("./fakes")).cloudflareMock(ctx, (p) => p));
const { POST: book } = await import("@/app/api/book/route");
const { POST: change } = await import("@/app/api/booking/[id]/route");
const { bookDeposit } = await import("@/lib/booking/deposit");

const SECRET = "booking-secret-for-tests";
/** A Wednesday 10 AM Pacific at least `days` out. */
const wednesday = (days: number) => {
  const d = new Date(Date.now() + days * 864e5);
  d.setUTCDate(d.getUTCDate() + ((3 - d.getUTCDay() + 7) % 7));
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 18)).toISOString();
};
const plus = (iso: string, hours: number) => new Date(Date.parse(iso) + hours * 36e5).toISOString();

let busy: { start: string; end: string; id: string }[];
let calls: { method: string; url: string; form?: string; body?: { start: { dateTime: string }; end: { dateTime: string } } }[];
let refundOk: boolean;
let store: FakeStore;
let client: FakeEmail;
let mail: FakeEmail;

beforeEach(() => {
  forgetToken();
  busy = [];
  calls = [];
  refundOk = true;
  store = new FakeStore();
  client = new FakeEmail();
  mail = new FakeEmail();
  ctx.env = {
    GCAL_OAUTH: OAUTH,
    BOOKING_SECRET: SECRET,
    BOOKING_LOCK: fakeLock(new BookingLock({ storage: store }, { GCAL_OAUTH: OAUTH })),
    INBOX_KEY: KEY,
    INBOX: new FakeKV(),
    LEADS_KEY,
    CLIENT_EMAIL: client,
    EMAIL: mail,
    STRIPE_SECRET_KEY: "sk_test_x",
    PUBLIC_WRITE_LIMIT: { limit: async () => ({ success: true }) },
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    const method = init?.method ?? "GET";
    const body = init?.body && !url.startsWith("https://api.stripe.com") ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body, form: url.startsWith("https://api.stripe.com") ? String(init?.body ?? "") : undefined });
    if (url.includes("/events?q=")) return Response.json({ items: [] });
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
      if (!busy.some((x) => x.id === ev)) return Response.json({ error: { message: "Not Found" } }, { status: 404 });
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
  const meta = { kind: "deposit", slug: "portraits", start, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com" };
  expect(await bookDeposit(ctx.env as never, "pi_TEST1234567890", meta)).toBe("booked");
  const link = String(client.sent.at(-1)!.text).match(/\/booking\/(\w+)\?t=([\w.-]+)&do=cancel/)!;
  return { id: link[1], t: link[2] };
}
const post = (id: string, body: unknown, key?: string) =>
  change(new Request(`https://juliangigola.com/api/booking/${id}`, { method: "POST", body: JSON.stringify(body), headers: key ? { "x-admin-key": key } : {} }), { params: Promise.resolve({ id }) });

describe("the link", () => {
  it("opens its own booking until a day after it, and nothing else", async () => {
    const t = await bookingToken(SECRET, "abc", Date.now() + 864e5);
    expect(await tokenOpens(SECRET, "abc", t)).toBe(true);
    expect(await tokenOpens(SECRET, "abd", t)).toBe(false);
    expect(await tokenOpens("other", "abc", t)).toBe(false);
    expect(await tokenOpens(undefined, "abc", t)).toBe(false);
    // The first signature character: all 6 bits count (the last one carries 2 padding bits, so A to D decode alike).
    expect(await tokenOpens(SECRET, "abc", t.replace(/\.(.)/, (_, c) => "." + (c === "A" ? "B" : "A")))).toBe(false);
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
  it("48 hours or more ahead: off the calendar, 90% refunded, 10% kept as the fee, both told", async () => {
    const { id, t } = await paid(wednesday(7));
    const res = await post(id, { t, action: "cancel" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ refunded: true, record: { cancelled: true, paid: true } });
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("sendUpdates=none"))).toBe(true);
    expect(calls.filter((c) => c.url.endsWith("/refunds"))).toHaveLength(1);
    expect(calls.find((c) => c.url.endsWith("/refunds"))!.form).toContain("amount=22500");
    expect(String(client.sent.at(-1)!.text)).toContain("$225 of your $250 deposit is refunded to your card. $25 is kept as the booking fee.");
    expect(mail.sent.at(-1)!.subject).toMatch(/^Cancelled: /);
    expect(String(client.sent.at(-1)!.text)).toContain("refunded to your card");
    // A second click does nothing more.
    expect((await post(id, { t, action: "cancel" })).status).toBe(409);
    expect(calls.filter((c) => c.url.endsWith("/refunds"))).toHaveLength(1);
  });

  it("under 48 hours but 24 or more: cancelled, 70% refunded, 30% kept, both told the figure", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(start) - 47 * 36e5);
    const res = await post(id, { t, action: "cancel" });
    vi.setSystemTime(PIN);
    expect(await res.json()).toMatchObject({ refunded: true, back: 175, record: { cancelled: true } });
    const refunds = calls.filter((c) => c.url.endsWith("/refunds"));
    expect(refunds).toHaveLength(1);
    expect(refunds[0].form).toContain("amount=17500");
    expect(String(client.sent.at(-1)!.text)).toContain("$175 of your $250 deposit is refunded");
    expect(String(mail.sent.at(-1)!.text)).toContain("Refunded $175 of the $250 deposit");
  });

  it("at exactly 24 hours: still 70%", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(start) - 24 * 36e5);
    const res = await post(id, { t, action: "cancel" });
    vi.setSystemTime(PIN);
    expect(await res.json()).toMatchObject({ refunded: true, back: 175 });
  });

  it("under 24 hours: cancelled, deposit kept", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(start) - 23 * 36e5);
    const res = await post(id, { t, action: "cancel" });
    vi.setSystemTime(PIN);
    expect(await res.json()).toMatchObject({ refunded: null, back: 0, record: { cancelled: true } });
    expect(calls.some((c) => c.url.endsWith("/refunds"))).toBe(false);
    expect(String(client.sent.at(-1)!.text)).toContain("not refunded");
  });

  it("names the figure to refund by hand when a 70% refund fails", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    refundOk = false;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(start) - 30 * 36e5);
    const res = await post(id, { t, action: "cancel" });
    vi.setSystemTime(PIN);
    expect(await res.json()).toMatchObject({ refunded: false, back: 0 });
    expect(String(mail.sent.at(-1)!.text)).toContain("refund $175 by hand");
  });

  it("a booking made before the fee was sold a full refund, and still gets it", async () => {
    const { id, t } = await paid(wednesday(7));
    const r = (await findBooking(store, id))!;
    delete r.fee;
    await saveBooking(store, r);
    const res = await post(id, { t, action: "cancel" });
    expect(await res.json()).toMatchObject({ refunded: true, back: 250 });
    expect(calls.find((c) => c.url.endsWith("/refunds"))!.form).not.toContain("amount");
    expect(String(client.sent.at(-1)!.text)).toContain("Your $250 deposit is refunded to your card.");
  });

  it("judges the refund by the time first booked: moved out, then cancelled, keeps the deposit", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(start) - 30 * 36e5);
    expect((await post(id, { t, action: "reschedule", start: plus(start, 7 * 24) })).status).toBe(200);
    // The move says so: to the client and to hello@.
    expect(String(client.sent.at(-1)!.text)).toContain("now refunds 70%");
    expect(String(mail.sent.at(-1)!.text)).toContain("now refunds 70%");
    vi.setSystemTime(Date.parse(start) - 23 * 36e5);
    const res = await post(id, { t, action: "cancel" });
    vi.setSystemTime(PIN);
    expect(await res.json()).toMatchObject({ refunded: null, record: { cancelled: true, firstStart: start } });
    expect(calls.some((c) => c.url.endsWith("/refunds"))).toBe(false);
    expect(String(client.sent.at(-1)!.text)).toContain("not refunded");
  });

  it("tells hello@ when the refund fails", async () => {
    const { id, t } = await paid(wednesday(7));
    refundOk = false;
    expect(await (await post(id, { t, action: "cancel" })).json()).toMatchObject({ refunded: false });
    expect(String(mail.sent.at(-1)!.text)).toContain("refund $225 by hand");
  });

  it("still cancels when the event was deleted from the calendar by hand", async () => {
    const { id, t } = await paid(wednesday(7));
    busy = [];
    const res = await post(id, { t, action: "cancel" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ record: { cancelled: true } });
  });

  it("answers a JSON null body with the expired-link 401, not a 500", async () => {
    const { id } = await paid(wednesday(7));
    expect((await post(id, null)).status).toBe(401);
  });

  it("a free call cancels with no money", async () => {
    const res = await book(new Request("https://juliangigola.com/api/book", { method: "POST", body: JSON.stringify({ slug: "music-call", start: wednesday(7), timeZone: "America/Los_Angeles", name: "QA", email: "qa@example.com", via: "Phone" }) }));
    const { id } = await res.json();
    const t = String(client.sent[0].text).match(/t=([\w.-]+)&do=cancel/)![1];
    expect(await (await post(id, { t, action: "cancel" })).json()).toMatchObject({ refunded: null, record: { paid: false } });
  });
});

describe("the lead desk", () => {
  it("files the booking on the person's lead, and logs every mail the move and the cancel send", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    expect((await post(id, { t, action: "reschedule", start: plus(start, 2) })).status).toBe(200);
    expect((await post(id, { t, action: "cancel" })).status).toBe(200);
    const lead = (await leadOf(ctx.env.INBOX as FakeKV, "qa@example.com"))!;
    expect(lead.events.find((e) => e.kind === "booking")).toMatchObject({ ref: id, note: "Portraits" });
    const mails = lead.events.filter((e) => e.kind === "mail").map((e) => `${e.mail?.to} ${e.mail?.kind}`);
    expect(mails).toEqual(expect.arrayContaining(["client confirm", "hello@ reschedule", "client reschedule", "hello@ cancelled", "client cancelled"]));
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
    expect(String(client.sent[1].text)).toContain("judged by the time you first booked");
  });

  it("moves twice, then refuses a third move and still lets it be cancelled", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    expect((await post(id, { t, action: "reschedule", start: plus(start, 2) })).status).toBe(200);
    const second = await post(id, { t, action: "reschedule", start: plus(start, 4) });
    expect((await second.json()).record).toMatchObject({ moves: 2 });
    const third = await post(id, { t, action: "reschedule", start: plus(start, 6) });
    expect(third.status).toBe(403);
    expect((await third.json()).error).toContain("moved twice");
    expect((await post(id, { t, action: "cancel" })).status).toBe(200);
  });

  it("refuses a move inside the last 24 hours, and still lets it be cancelled", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(start) - 23 * 36e5);
    const res = await post(id, { t, action: "reschedule", start: plus(start, 7 * 24) });
    const cancelled = await post(id, { t, action: "cancel" });
    vi.setSystemTime(PIN);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("under 24 hours");
    expect(cancelled.status).toBe(200);
  });

  it("is not blocked by its own old time, only by another booking", async () => {
    const start = wednesday(7);
    const { id, t } = await paid(start);
    busy.push({ start: plus(start, 3), end: plus(start, 4), id: "other" });
    const refused = await post(id, { t, action: "reschedule", start: plus(start, 3) });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: "That time was just taken. Pick another.", code: "taken" });
    // One hour on: its own 10 to 11 plus buffer would be in the way if it were not its own.
    expect((await post(id, { t, action: "reschedule", start: plus(start, 1) })).status).toBe(200);
  });
});

describe("the desk", () => {
  it("is closed to the client's token and to no key at all", async () => {
    const { id, t } = await paid(wednesday(7));
    expect((await post(id, { t, action: "cancel-mine" })).status).toBe(401);
    expect((await post(id, { action: "no-show" })).status).toBe(401);
    expect(calls.some((c) => c.url.endsWith("/refunds"))).toBe(false);
  });

  it("Julian cancels: off the calendar, the whole deposit back even inside 24 hours, the client and hello@ told, the lead logged once", async () => {
    const start = wednesday(7);
    const { id } = await paid(start);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(start) - 3 * 36e5);
    const res = await post(id, { action: "cancel-mine" }, KEY);
    vi.setSystemTime(PIN);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ refunded: true, back: 250, record: { cancelled: true } });
    const refunds = calls.filter((c) => c.url.endsWith("/refunds"));
    expect(refunds).toHaveLength(1);
    expect(refunds[0].form).not.toContain("amount");
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("sendUpdates=none"))).toBe(true);
    expect(String(client.sent.at(-1)!.text)).toContain("I had to cancel this one");
    expect(String(client.sent.at(-1)!.text)).toContain("Your $250 deposit is refunded in full to your card.");
    expect(mail.sent.at(-1)!.subject).toMatch(/^Cancelled by you: /);
    expect(String(mail.sent.at(-1)!.text)).toContain("Deposit refunded in full: $250.");
    const events = (await leadOf(ctx.env.INBOX as FakeKV, "qa@example.com"))!.events;
    expect(events.filter((e) => e.kind === "refund").map((e) => [e.ref, e.amount])).toEqual([["refund-pi_TEST1234567890", 250]]);
    expect(events.some((e) => e.kind === "cancel" && String(e.note).endsWith("by Julian"))).toBe(true);
    // A second click does nothing more.
    expect((await post(id, { action: "cancel-mine" }, KEY)).status).toBe(409);
    expect(calls.filter((c) => c.url.endsWith("/refunds"))).toHaveLength(1);
  });

  it("Julian cancels and the refund fails: hello@ gets the figure to refund by hand, the client hears it goes by hand, no refund line", async () => {
    const { id } = await paid(wednesday(7));
    refundOk = false;
    expect(await (await post(id, { action: "cancel-mine" }, KEY)).json()).toMatchObject({ refunded: false, back: 0, record: { cancelled: true } });
    expect(String(mail.sent.at(-1)!.text)).toContain("The refund FAILED: refund $250 by hand in Stripe.");
    expect(String(client.sent.at(-1)!.text)).toContain("I'll send it by hand");
    const events = (await leadOf(ctx.env.INBOX as FakeKV, "qa@example.com"))!.events;
    expect(events.some((e) => e.kind === "refund")).toBe(false);
    expect(events.some((e) => e.kind === "cancel" && String(e.note).endsWith("by Julian"))).toBe(true);
  });

  it("a no-show: only after the start, a line on the lead, a mail to hello@, nothing refunded, the client not mailed, once", async () => {
    const start = wednesday(7);
    const { id } = await paid(start);
    expect((await post(id, { action: "no-show" }, KEY)).status).toBe(409);
    const before = client.sent.length;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(start) + 2 * 36e5);
    const res = await post(id, { action: "no-show" }, KEY);
    await post(id, { action: "no-show" }, KEY);
    vi.setSystemTime(PIN);
    expect(res.status).toBe(200);
    expect(calls.some((c) => c.url.endsWith("/refunds"))).toBe(false);
    expect(client.sent).toHaveLength(before);
    expect(mail.sent.some((m) => /^No-show: /.test(String(m.subject)) && String(m.text).includes("The $250 deposit is kept."))).toBe(true);
    const lead = (await leadOf(ctx.env.INBOX as FakeKV, "qa@example.com"))!;
    expect(lead.events.filter((e) => e.kind === "no-show")).toHaveLength(1);
  });
});
