import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeStore, fakeLock } from "./fakes";
import { forgetToken } from "@/lib/gcal";
import { BookingLock } from "@/worker/booking-lock";

/* Hours from the lead desk (`app/api/booking/hours`): only Julian can set
   them, malformed ones are refused, and the picker follows them at once. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const { GET, PUT } = await import("@/app/api/booking/hours/route");
const { GET: slots } = await import("@/app/api/slots/route");

const OAUTH = JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" });
const KEY = "inbox-key-for-tests";
const req = (method: string, body?: unknown, key = KEY) =>
  new Request("https://juliangigola.com/api/booking/hours", { method, headers: { "x-inbox-key": key }, body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  forgetToken();
  vi.setSystemTime(Date.parse("2026-11-11T18:00:00Z"));
  ctx.env = { GCAL_OAUTH: OAUTH, INBOX_KEY: KEY, BOOKING_LOCK: fakeLock(new BookingLock({ storage: new FakeStore() }, { GCAL_OAUTH: OAUTH })) };
  vi.stubGlobal("fetch", async (url: string) =>
    url.includes("oauth2") ? Response.json({ access_token: "t", expires_in: 3600 }) : Response.json({ calendars: { primary: { busy: [] } } }),
  );
});

describe("hours", () => {
  it("are Julian's to set, checked, and the picker follows them", async () => {
    expect((await GET(req("GET", undefined, "wrong"))).status).toBe(401);
    expect((await PUT(req("PUT", { week: [] }))).status).toBe(400);
    expect((await (await GET(req("GET"))).json()).hours.week[1]).toBeNull();

    // Monday Nov 23 opened 8 to 9 AM; the rest of the week as it was.
    const week = [[600, 1140], null, null, [600, 1140], [600, 1140], [600, 1140], [600, 1140]];
    expect((await PUT(req("PUT", { week, days: { "2026-11-23": [480, 540] } }))).status).toBe(200);
    expect((await (await GET(req("GET"))).json()).hours.days).toEqual({ "2026-11-23": [480, 540] });

    const r = await (await slots(new Request("https://juliangigola.com/api/slots?slug=portraits&start=2026-11-23&end=2026-11-23&timeZone=America/Los_Angeles"))).json();
    expect(r.data["2026-11-23"].map((x: { start: string }) => x.start.slice(11, 16))).toEqual(["08:00", "09:00"]);
    vi.useRealTimers();
  });
});
