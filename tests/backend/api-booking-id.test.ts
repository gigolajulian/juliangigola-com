import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/booking/[id]/route";
import { bookingToken } from "@/lib/booking/booking-token";
import { forgetToken } from "@/lib/booking/gcal";
import { BookingLock } from "@/worker/booking-lock";
import { FakeEmail, FakeKV, FakeStore, fakeLock, LEADS_KEY } from "./fakes";

/* /api/booking/[id]: the mail's signed token opens one booking; a cancel
   with no deposit takes the event off the calendar and mails both sides. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const SECRET = "booking-secret-for-tests";
const OAUTH = JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" });
const ID = "AbCdEfGh12345678";
const START = new Date(Date.now() + 7 * 864e5).toISOString();
const END = new Date(Date.parse(START) + 36e5).toISOString();

let client: FakeEmail;
let mail: FakeEmail;
let deleted: string[];
beforeEach(async () => {
  forgetToken();
  client = new FakeEmail();
  mail = new FakeEmail();
  deleted = [];
  const storage = new FakeStore();
  await storage.put(`b:${ID}`, { id: ID, eventId: "ev1", slug: "portraits", session: "Portraits", start: START, end: END, timeZone: "America/Los_Angeles", name: "QA Test", email: "qa@example.com", at: new Date().toISOString() });
  ctx.env = { GCAL_OAUTH: OAUTH, BOOKING_SECRET: SECRET, BOOKING_LOCK: fakeLock(new BookingLock({ storage }, { GCAL_OAUTH: OAUTH })), INBOX: new FakeKV(), LEADS_KEY, CLIENT_EMAIL: client, EMAIL: mail };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    if (init?.method === "DELETE") {
      deleted.push(url);
      return new Response(null, { status: 204 });
    }
    return Response.json({}, { status: 404 });
  });
});

const post = (body: unknown, id = ID) => POST(new Request(`https://juliangigola.com/api/booking/${id}`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const token = () => bookingToken(SECRET, ID, Date.parse(START) + 864e5);

describe("POST /api/booking/[id]", () => {
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
  });
});
