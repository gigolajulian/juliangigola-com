import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEmail, FakeKV, FakeStore, fakeLock } from "./fakes";
import { forgetToken } from "@/lib/booking/gcal";
import { BookingLock } from "@/worker/booking-lock";

// Pinned clock: weekday hours, DST and the 48h refund window must not depend on the day the suite runs.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-11-11T20:00:00Z")); // a Wednesday, noon in San Jose

/* The site's own engine (`lib/booking/booking-engine.ts`, `worker/booking-lock.ts`):
   a time is rechecked and inserted inside the lock, so two tabs on one slot
   get one booking; a free call books from `/api/book`, a paid session from
   Stripe's webhook, and both file the Inbox row and the client's mail. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env, ctx: { waitUntil: (p: Promise<unknown>) => p } }) }));
const { POST: book } = await import("@/app/api/book/route");
const { settle } = await import("@/lib/booking/deposit");

// Wednesday 10 AM Pacific, a week out.
const now = Date.now();
const wed = new Date(now + 7 * 864e5);
wed.setUTCDate(wed.getUTCDate() + ((3 - wed.getUTCDay() + 7) % 7));
const START = new Date(Date.UTC(wed.getUTCFullYear(), wed.getUTCMonth(), wed.getUTCDate(), 18)).toISOString();
const CALL = { engine: "own", slug: "editorial", start: START, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com", phone: "+14085550100", via: "Video" };

let busy: { start: string; end: string }[];
let inserts: { url: string; body: Record<string, unknown> }[];
let stripeCalls: string[];
let kv: FakeKV;
let store: FakeStore;
let client: FakeEmail;
let mail: FakeEmail;

beforeEach(() => {
  forgetToken();
  busy = [];
  inserts = [];
  stripeCalls = [];
  kv = new FakeKV();
  store = new FakeStore();
  client = new FakeEmail();
  mail = new FakeEmail();
  ctx.env = {
    GCAL_OAUTH: JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" }),
    BOOKING_LOCK: fakeLock(new BookingLock({ storage: store }, { GCAL_OAUTH: JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" }) })),
    INBOX: kv,
    CLIENT_EMAIL: client,
    EMAIL: mail,
    STRIPE_SECRET_KEY: "sk_test_x",
    DEPOSIT_LIMIT: { limit: async () => ({ success: true }) },
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    // Google is slow, so without the lock a second booking would recheck before the first inserts.
    await new Promise((go) => setTimeout(go, 5));
    if (url.includes("/events?q=")) return Response.json({ items: [] });
    if (url.includes("/freeBusy")) return Response.json({ calendars: { primary: { busy } } });
    if (url.includes("/events")) {
      const body = JSON.parse(String(init?.body));
      inserts.push({ url, body });
      busy.push({ start: body.start.dateTime, end: body.end.dateTime });
      return Response.json({ id: `ev${inserts.length}`, hangoutLink: "https://meet.google.com/abc" });
    }
    if (url.startsWith("https://api.stripe.com")) {
      stripeCalls.push(url);
      return Response.json({ id: "x", status: "succeeded" });
    }
    return Response.json({}, { status: 404 });
  });
});

const post = (body: unknown) => book(new Request("https://juliangigola.com/api/book", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/book (a free call)", () => {
  it("inserts the event with no Google mail, keeps the record, files it and mails the client", async () => {
    const res = await post(CALL);
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toMatchObject({ status: "success", data: { start: START, where: "https://meet.google.com/abc" } });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].url).toContain("sendUpdates=none");
    expect(inserts[0].url).toContain("conferenceDataVersion=1");
    expect(inserts[0].body).toMatchObject({ summary: "Editorial call: QA Test", attendees: [{ email: "qa@example.com" }] });
    expect(store.data.get(`b:${out.data.uid}`)).toMatchObject({ eventId: "ev1", email: "qa@example.com", call: true });
    expect(kv.json(kv.puts[0])).toMatchObject({ type: "booking", name: "QA Test" });
    expect(client.sent).toHaveLength(1);
    expect(String(client.sent[0].html)).not.toContain("cal.com");
  });

  it("gives one of two tabs on the same time the booking, the other a 409", async () => {
    const [a, b] = await Promise.all([post(CALL), post(CALL)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(inserts).toHaveLength(1);
  });

  it("refuses a paid session, and a phone call gets no Meet", async () => {
    expect((await post({ ...CALL, slug: "portraits" })).status).toBe(400);
    expect((await post({ ...CALL, via: "Phone" })).status).toBe(200);
    expect(inserts[0].url).not.toContain("conferenceDataVersion");
  });

  it("is off without the calendar", async () => {
    delete ctx.env.GCAL_OAUTH;
    expect((await post(CALL)).status).toBe(503);
  });
});

describe("settle (a paid session on the site's engine)", () => {
  const META = { kind: "deposit", engine: "own", slug: "portraits", start: START, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com" };
  const env = () => ctx.env as unknown as Parameters<typeof settle>[0];

  it("books through the lock, files the deposit, and books once however often Stripe delivers", async () => {
    expect(await settle(env(), "pi_TEST1234567890", META)).toBe("booked");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].body.description).toContain("pi_TEST1234567890");
    expect(kv.json(kv.puts.find((k) => k.startsWith("msg:"))!)).toMatchObject({ type: "booking", deposit: expect.stringContaining("pi_TEST1234567890") });
    expect(client.sent).toHaveLength(1);
    // A second delivery whose KV record was lost: the lock still knows the intent.
    await settle({ ...env(), INBOX: new FakeKV() as never }, "pi_TEST1234567890", META);
    expect(inserts).toHaveLength(1);
  });

  it("refunds when the time is gone", async () => {
    busy = [{ start: START, end: new Date(Date.parse(START) + 36e5).toISOString() }];
    expect(await settle(env(), "pi_TEST1234567890", META)).toBe("refunded");
    expect(inserts).toHaveLength(0);
    expect(stripeCalls.some((u) => u.endsWith("/refunds"))).toBe(true);
    expect(String(mail.sent[0].text)).toContain("The time was gone");
  });

  it("refunds on a booking error and says what broke, not that the time was gone", async () => {
    const broken = { idFromName: (n: string) => n, get: () => ({ fetch: async () => { throw new Error("lock down"); } }) };
    expect(await settle({ ...env(), BOOKING_LOCK: broken as never }, "pi_TEST1234567890", META)).toBe("refunded");
    expect(stripeCalls.some((u) => u.endsWith("/refunds"))).toBe(true);
    const text = String(mail.sent[0].text);
    expect(text).toContain("lock down");
    expect(text).not.toContain("The time was gone");
  });
});
