import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeEmail, FakeKV, FakeStore, fakeLock, LEADS_KEY, refusesTargets } from "../fakes";
import { readLog } from "@/lib/leads/activity-log";
import { sealer } from "@/lib/seal";
import { forgetToken } from "@/lib/google";
import { BookingLock } from "@/worker/booking-lock";

// Pinned clock: weekday hours, DST and the 48h refund window must not depend on the day the suite runs.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-11-11T20:00:00Z")); // a Wednesday, noon in San Jose

/* The site's own engine (`lib/booking/engine.ts`, `worker/booking-lock.ts`):
   a time is rechecked and inserted inside the lock, so two tabs on one slot
   get one booking; a free call books from `/api/book`, a paid session from
   Stripe's webhook, and both file the Inbox row and the client's mail. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
// The route's ctx.waitUntil work (the filing, the client's mail, hello@'s alert), kept so a test can wait for it.
const background = vi.hoisted(() => [] as Promise<unknown>[]);
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx, (p) => background.push(p)));
const settled = () => Promise.all(background.splice(0));
const { POST: book } = await import("@/app/api/book/route");
const { bookDeposit, RETRY_MS } = await import("@/lib/booking/deposit");

// Wednesday 10 AM Pacific, a week out.
const now = Date.now();
const wed = new Date(now + 7 * 864e5);
wed.setUTCDate(wed.getUTCDate() + ((3 - wed.getUTCDay() + 7) % 7));
const START = new Date(Date.UTC(wed.getUTCFullYear(), wed.getUTCMonth(), wed.getUTCDate(), 18)).toISOString();
const CALL = {
  slug: "editorial",
  start: START,
  timeZone: "America/Los_Angeles",
  name: "QA Test",
  email: "qa@example.com",
  phone: "+14085550100",
  via: "Video",
};

let busy: { start: string; end: string }[];
let inserts: { url: string; body: Record<string, unknown> }[];
let stripeCalls: string[];
let deletes: string[];
let kv: FakeKV;
let store: FakeStore;
let client: FakeEmail;
let mail: FakeEmail;

beforeEach(() => {
  forgetToken();
  busy = [];
  inserts = [];
  stripeCalls = [];
  deletes = [];
  kv = new FakeKV();
  store = new FakeStore();
  client = new FakeEmail();
  mail = new FakeEmail();
  ctx.env = {
    GCAL_OAUTH: JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" }),
    BOOKING_LOCK: fakeLock(
      new BookingLock({ storage: store }, { GCAL_OAUTH: JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" }) }),
    ),
    INBOX: kv,
    CLIENT_EMAIL: client,
    EMAIL: mail,
    STRIPE_SECRET_KEY: "sk_test_x",
    PUBLIC_WRITE_LIMIT: { limit: async () => ({ success: true }) },
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    // Google is slow, so without the lock a second booking would recheck before the first inserts.
    await new Promise((go) => setTimeout(go, 5));
    if (url.includes("/events?q=")) return Response.json({ items: [] });
    if (url.includes("/freeBusy")) return Response.json({ calendars: { primary: { busy } } });
    if (init?.method === "DELETE") {
      // An event taken off the calendar frees its time again.
      const ev = inserts.findIndex((_, i) => url.includes(`/events/ev${i + 1}?`));
      if (ev >= 0) busy = busy.filter((x) => x.start !== (inserts[ev].body.start as { dateTime: string }).dateTime);
      deletes.push(url);
      return new Response(null, { status: 204 });
    }
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
  it("limits per target: many addresses booking calls for one email meet one limit", async () => {
    const lim = refusesTargets();
    ctx.env.PUBLIC_WRITE_LIMIT = lim;
    expect((await post(CALL)).status).toBe(429);
    expect(lim.keys.some((k) => k.startsWith("book:t:"))).toBe(true);
    expect(inserts).toEqual([]);
  });

  it("inserts the event with no Google mail, keeps the record, files it and mails the client", async () => {
    const res = await post(CALL);
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toMatchObject({ start: START, where: "https://meet.google.com/abc" });
    expect(inserts).toHaveLength(1);
    expect(inserts[0].url).toContain("sendUpdates=none");
    expect(inserts[0].url).toContain("conferenceDataVersion=1");
    expect(inserts[0].body).toMatchObject({ summary: "Editorial call: QA Test", attendees: [{ email: "qa@example.com" }] });
    expect(store.data.get(`b:${out.id}`)).toMatchObject({ eventId: "ev1", email: "qa@example.com", call: true });
    await settled();
    expect(kv.json(kv.puts.find((k) => !k.startsWith("callcap:"))!)).toMatchObject({ type: "booking", name: "QA Test" });
    expect(client.sent).toHaveLength(1);
    expect(String(client.sent[0].html)).not.toContain("cal.com");
  });

  it("keeps no Where on a call, so a stranger's text never reaches the client's mail", async () => {
    const res = await post({ ...CALL, via: "Phone", where: "Win a prize at example.net" });
    expect(res.status).toBe(200);
    await settled();
    expect(String(client.sent[0].html)).not.toContain("example.net");
    expect(inserts[0].body).not.toHaveProperty("location");
  });

  it("books two calls a day per address, then answers 429 without touching the calendar", async () => {
    const at = (h: number) => new Date(Date.parse(START) + h * 3600e3).toISOString();
    expect((await post({ ...CALL, start: at(0) })).status).toBe(200);
    expect((await post({ ...CALL, start: at(1) })).status).toBe(200);
    const third = await post({ ...CALL, start: at(2), email: "QA@example.com" });
    expect(third.status).toBe(429);
    expect(inserts).toHaveLength(2);
    expect((await post({ ...CALL, start: at(2), email: "someone-else@example.com" })).status).toBe(200);
  });

  it("gives one of two tabs on the same time the booking, the other a 409", async () => {
    const [a, b] = await Promise.all([post(CALL), post(CALL)]);
    expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 409]);
    expect(await (a.status === 409 ? a : b).json()).toEqual({ error: "That time was just taken. Pick another.", code: "taken" });
    expect(inserts).toHaveLength(1);
  });

  it("refuses a paid session, and a phone call gets no Meet", async () => {
    expect((await post({ ...CALL, slug: "portraits" })).status).toBe(400);
    expect((await post({ ...CALL, via: "Phone" })).status).toBe(200);
    expect(inserts[0].url).not.toContain("conferenceDataVersion");
  });

  it("tells hello@ a video call by its Meet link, and a phone call by the number", async () => {
    const text = (m: { text?: unknown }) => String(m.text);
    await post(CALL);
    await settled();
    expect(text(mail.sent.at(-1)!)).toContain("Video call: https://meet.google.com/abc");
    expect(text(mail.sent.at(-1)!)).not.toContain("ring");
    await post({ ...CALL, via: "Phone", start: "2026-12-02T18:00:00.000Z" });
    await settled();
    expect(text(mail.sent.at(-1)!)).toContain("Call: ring +14085550100");
  });

  it("is off without the calendar", async () => {
    delete ctx.env.GCAL_OAUTH;
    expect((await post(CALL)).status).toBe(503);
  });
});

describe("bookDeposit (a paid session on the site's engine)", () => {
  const META = {
    kind: "deposit",
    slug: "portraits",
    start: START,
    timeZone: "America/Los_Angeles",
    name: "QA Test",
    email: "qa@example.com",
  };
  const env = () => ctx.env as unknown as Parameters<typeof bookDeposit>[0];

  it("books through the lock, files the deposit, and books once however often Stripe delivers", async () => {
    expect(await bookDeposit(env(), "pi_TEST1234567890", META)).toBe("booked");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].body.description).toContain("pi_TEST1234567890");
    expect(kv.json(kv.puts.find((k) => k.startsWith("msg:"))!)).toMatchObject({
      type: "booking",
      deposit: expect.stringContaining("pi_TEST1234567890"),
    });
    expect(client.sent).toHaveLength(1);
    // A second delivery whose KV record was lost: the lock still knows the intent.
    await bookDeposit({ ...env(), INBOX: new FakeKV() as never }, "pi_TEST1234567890", META);
    expect(inserts).toHaveLength(1);
  });

  it("logs the deposit on the client's activity log", async () => {
    ctx.env = { ...ctx.env, LEADS_KEY };
    expect(await bookDeposit(env(), "pi_TEST1234567890", META)).toBe("booked");
    const s = (await sealer(LEADS_KEY))!;
    expect((await readLog(kv as never, s, await s.id("qa@example.com"))).find((e) => e.kind === "payment")).toMatchObject({
      amount: 250,
      note: "Deposit",
    });
  });

  it("refunds when the time is gone", async () => {
    busy = [{ start: START, end: new Date(Date.parse(START) + 36e5).toISOString() }];
    expect(await bookDeposit(env(), "pi_TEST1234567890", META)).toBe("refunded");
    expect(inserts).toHaveLength(0);
    expect(stripeCalls.some((u) => u.endsWith("/refunds"))).toBe(true);
    expect(String(mail.sent[0].text)).toContain("The time was gone");
  });

  it("refunds on a booking error and says what broke, not that the time was gone", async () => {
    const broken = {
      idFromName: (n: string) => n,
      get: () => ({
        fetch: async () => {
          throw new Error("lock down");
        },
      }),
    };
    expect(await bookDeposit({ ...env(), BOOKING_LOCK: broken as never }, "pi_TEST1234567890", META)).toBe("refunded");
    expect(stripeCalls.some((u) => u.endsWith("/refunds"))).toBe(true);
    const text = String(mail.sent[0].text);
    expect(text).toContain("lock down");
    expect(text).not.toContain("The time was gone");
  });

  it("asks the lock again after an error, and keeps a booking it made instead of refunding", async () => {
    const real = env().BOOKING_LOCK as unknown as {
      idFromName(n: string): unknown;
      get(id: unknown): { fetch(url: string, init?: RequestInit): Promise<Response> };
    };
    let calls = 0;
    // The first answer is lost after the lock booked: the retry finds the booking by its intent.
    const flaky = {
      idFromName: (n: string) => real.idFromName(n),
      get: (id: unknown) => ({
        fetch: async (url: string, init?: RequestInit) => {
          const res = await real.get(id).fetch(url, init);
          if (++calls === 1) throw new Error("answer lost");
          return res;
        },
      }),
    };
    const t = performance.now();
    expect(await bookDeposit({ ...env(), BOOKING_LOCK: flaky as never }, "pi_TEST1234567890", META)).toBe("booked");
    expect(performance.now() - t).toBeGreaterThanOrEqual(RETRY_MS - 50);
    expect(inserts).toHaveLength(1);
    expect(stripeCalls.some((u) => u.endsWith("/refunds"))).toBe(false);
  });

  it("takes its own event off the calendar when the record cannot be saved, so the retry books it", async () => {
    // The lock's store refuses the first booking record, after Google made the event.
    const put = store.put.bind(store);
    let refused = false;
    store.put = async (k: string, v: unknown) => {
      if (k.startsWith("b:") && !refused) {
        refused = true;
        throw new Error("storage down");
      }
      return put(k, v);
    };
    expect(await bookDeposit(env(), "pi_TEST1234567890", META)).toBe("booked");
    expect(deletes).toEqual([expect.stringContaining("/events/ev1?")]);
    expect(inserts).toHaveLength(2);
    expect(stripeCalls.some((u) => u.endsWith("/refunds"))).toBe(false);
  });
});
