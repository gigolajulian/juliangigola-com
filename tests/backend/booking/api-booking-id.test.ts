import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readLog } from "@/lib/leads/activity-log";
import { sealer } from "@/lib/seal";
import { POST } from "@/app/api/booking/[id]/route";
import { POST as DESK } from "@/app/api/booking/[id]/desk/route";
import { bookingToken } from "@/lib/booking/manage-link";
import { forgetToken } from "@/lib/google";
import { BookingLock } from "@/worker/booking-lock";
import { FakeEmail, FakeKV, FakeStore, fakeLock, LEADS_KEY, INBOX_KEY as KEY, GOOGLE_OAUTH as OAUTH } from "../fakes";
import { refusesTargets } from "../fakes";

/* /api/booking/[id]: the mail's signed token opens one booking; a cancel
   with no deposit takes the event off the calendar and mails both sides.
   Its writes share the public limiter. /api/booking/[id]/desk: the admin gate
   only, checked before the body. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", async () => (await import("../fakes")).cloudflareMock(ctx));

const SECRET = "booking-secret-for-tests";
const ID = "AbCdEfGh12345678";
// A pinned clock, so the week-out booking and its token read the same on every run.
const PIN = Date.parse("2026-11-24T20:00:00Z");
const START = new Date(PIN + 7 * 864e5).toISOString();
const END = new Date(Date.parse(START) + 36e5).toISOString();

let client: FakeEmail;
let mail: FakeEmail;
let deleted: string[];
let allowed: boolean;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(PIN);
  forgetToken();
  allowed = true;
  client = new FakeEmail();
  mail = new FakeEmail();
  deleted = [];
  const storage = new FakeStore();
  await storage.put(`b:${ID}`, {
    id: ID,
    eventId: "ev1",
    slug: "portraits",
    session: "Portraits",
    start: START,
    end: END,
    timeZone: "America/Los_Angeles",
    name: "QA Test",
    email: "qa@example.com",
    at: new Date().toISOString(),
  });
  ctx.env = {
    GCAL_OAUTH: OAUTH,
    BOOKING_SECRET: SECRET,
    BOOKING_LOCK: fakeLock(new BookingLock({ storage }, { GCAL_OAUTH: OAUTH })),
    INBOX: new FakeKV(),
    LEADS_KEY,
    CLIENT_EMAIL: client,
    EMAIL: mail,
    INBOX_KEY: KEY,
    PUBLIC_WRITE_LIMIT: { limit: async () => ({ success: allowed }) },
  };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    if (init?.method === "DELETE") {
      deleted.push(url);
      return new Response(null, { status: 204 });
    }
    return Response.json({}, { status: 404 });
  });
});
afterEach(() => vi.useRealTimers());

const post = (body: unknown, id = ID) =>
  POST(new Request(`https://juliangigola.com/api/booking/${id}`, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
const token = () => bookingToken(SECRET, ID, Date.parse(START) + 864e5);
const desk = (body: unknown, key?: string) =>
  DESK(
    new Request(`https://juliangigola.com/api/booking/${ID}/desk`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: key ? { "x-admin-key": key } : {},
    }),
    { params: Promise.resolve({ id: ID }) },
  );

describe("POST /api/booking/[id]", () => {
  it("limits per target: many addresses aimed at one booking meet one limit", async () => {
    const lim = refusesTargets();
    ctx.env.PUBLIC_WRITE_LIMIT = lim;
    expect((await post({ action: "cancel", t: await token() })).status).toBe(429);
    expect(lim.keys).toContain(`booking:t:${ID}`);
    expect(deleted).toEqual([]);
  });

  it("refuses no token, a wrong one, and a token for another booking", async () => {
    expect((await post({ action: "cancel" })).status).toBe(401);
    expect((await post({ action: "cancel", t: "123456789.x" })).status).toBe(401);
    expect((await post({ action: "cancel", t: await token() }, "ZzZzZzZz87654321")).status).toBe(401);
    expect(deleted).toEqual([]);
  });

  it("refuses an unknown action and a reschedule without a start", async () => {
    const t = await token();
    expect((await post({ t, action: "nope" })).status).toBe(400);
    expect((await post({ t, action: "reschedule" })).status).toBe(400);
  });

  it("cancels: the event leaves the calendar, both sides are mailed, a second cancel is refused", async () => {
    const t = await token();
    const res = await post({ t, action: "cancel" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ record: { id: ID, cancelled: true, paid: false }, refunded: null });
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toContain("/events/ev1");
    expect(mail.sent).toHaveLength(1);
    expect(client.sent).toHaveLength(1);
    expect((await post({ t, action: "cancel" })).status).toBe(409);
    const s = (await sealer(LEADS_KEY))!;
    expect((await readLog(ctx.env.INBOX as never, s, await s.id("qa@example.com"))).map((e) => e.kind)).toContain("cancel");
  });

  it("answers 429 past the public limit and changes nothing", async () => {
    allowed = false;
    const res = await post({ t: await token(), action: "cancel" });
    expect(res.status).toBe(429);
    expect(deleted).toEqual([]);
    expect(client.sent).toHaveLength(0);
  });

  it("still takes the desk's two actions behind the admin gate, for a desk tab loaded before the desk route", async () => {
    expect((await post({ action: "cancel-mine", t: await token() })).status).toBe(401);
    expect(
      (
        await POST(
          new Request(`https://juliangigola.com/api/booking/${ID}`, {
            method: "POST",
            body: JSON.stringify({ action: "cancel-mine" }),
            headers: { "x-admin-key": KEY },
          }),
          { params: Promise.resolve({ id: ID }) },
        )
      ).status,
    ).toBe(200);
    expect(deleted).toHaveLength(1);
  });
});

describe("POST /api/booking/[id]/desk", () => {
  it("refuses no key and the client's token before it reads the body", async () => {
    expect((await desk("not json")).status).toBe(401);
    expect((await desk({ action: "cancel-mine", t: await token() })).status).toBe(401);
    expect((await desk({ action: "cancel", t: await token() })).status).toBe(401);
    expect(deleted).toEqual([]);
  });

  it("answers 400 to anything but its two actions", async () => {
    expect((await desk("not json", KEY)).status).toBe(400);
    expect((await desk({ action: "cancel" }, KEY)).status).toBe(400);
    expect(deleted).toEqual([]);
  });

  it("cancels for Julian: off the calendar, the client told, a second cancel refused", async () => {
    const res = await desk({ action: "cancel-mine" }, KEY);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ record: { id: ID, cancelled: true }, refunded: null });
    expect(deleted).toHaveLength(1);
    expect(String(client.sent.at(-1)!.text)).toContain("I had to cancel this one");
    expect((await desk({ action: "cancel-mine" }, KEY)).status).toBe(409);
  });

  it("marks a no-show only once the session has started", async () => {
    expect((await desk({ action: "no-show" }, KEY)).status).toBe(409);
    vi.setSystemTime(Date.parse(START) + 2 * 36e5);
    expect((await desk({ action: "no-show" }, KEY)).status).toBe(200);
    expect(mail.sent.some((m) => /^No-show: /.test(String(m.subject)))).toBe(true);
  });
});
