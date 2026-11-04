import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanHours, EVENTS } from "@/lib/booking-rules";
import { forgetToken } from "@/lib/gcal";
import { localIso, startsFor, zoned } from "@/lib/slots";

/* The site's own open times (`lib/slots.ts`, `app/api/slots`): the rules
   Cal.com had, minus what hello@'s calendar says is busy, in the visitor's
   zone and Cal.com's shape. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));
const { GET } = await import("@/app/api/slots/route");

// Wednesday 2026-11-18, 10 AM Pacific (PST, UTC-8).
const WED10 = Date.parse("2026-11-18T18:00:00Z");
const NOW = WED10 - 7 * 864e5;
let busy: { start: string; end: string }[];
let asked: { timeMin: string; timeMax: string }[];

beforeEach(() => {
  forgetToken();
  busy = [];
  asked = [];
  ctx.env = { GCAL_OAUTH: JSON.stringify({ client_id: "a", client_secret: "b", refresh_token: "c" }) };
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "t", expires_in: 3600 });
    asked.push(JSON.parse(String(init?.body)));
    return Response.json({ calendars: { primary: { busy } } });
  });
});

describe("startsFor", () => {
  it("offers Wed to Sun, starts 10 AM to 7 PM Pacific, by the session's length", () => {
    const day = startsFor(EVENTS.portraits, [], WED10 - 36e5 * 10, WED10 + 864e5 - 36e5 * 10, NOW);
    expect(day.map((s) => localIso(s, "America/Los_Angeles").slice(11, 16))).toEqual(["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"]);
    // Monday and Tuesday are closed.
    expect(startsFor(EVENTS.portraits, [], WED10 - 2 * 864e5 - 10 * 36e5, WED10 - 10 * 36e5, NOW - 7 * 864e5)).toEqual([]);
  });

  it("keeps an hour before and after a shoot clear of anything busy, to travel", () => {
    const b = [{ start: WED10 + 3 * 36e5, end: WED10 + 4 * 36e5 }]; // 1 to 2 PM busy
    const day = startsFor(EVENTS.portraits, b, WED10, WED10 + 8 * 36e5, NOW).map((s) => (s - WED10) / 36e5);
    // 11:00 ends at 12:00, an hour before; 3 PM starts an hour after 2.
    expect(day).toEqual([0, 1, 5, 6, 7]);
    // A call has no travel.
    expect(startsFor(EVENTS["music-call"], b, WED10 + 2 * 36e5, WED10 + 5 * 36e5, NOW).map((s) => (s - WED10) / 36e5)).toEqual([2, 2.5, 4, 4.5]);
  });

  it("holds the notice and how far ahead", () => {
    expect(startsFor(EVENTS.portraits, [], WED10, WED10 + 864e5, WED10 - 47 * 36e5)[0]).toBe(WED10 + 36e5);
    expect(startsFor(EVENTS.editorial, [], WED10, WED10 + 36e5, WED10 - 25 * 36e5)).toEqual([WED10, WED10 + 18e5]);
    expect(startsFor(EVENTS.portraits, [], WED10, WED10 + 36e5, WED10 - 181 * 864e5)).toEqual([]);
  });

  it("follows Julian's hours: the week he set, and single dates", () => {
    const hm = (xs: number[]) => xs.map((s) => localIso(s, "America/Los_Angeles").slice(5, 16));
    const hours = { week: [null, null, null, [720, 900], null, null, null] as const, days: { "2026-11-16": [480, 600] as const, "2026-11-25": null } };
    const two = (from: number) => hm(startsFor(EVENTS.portraits, [], from, from + 864e5, NOW - 7 * 864e5, { week: [...hours.week], days: hours.days }));
    // A Monday opened 8 to 10.
    expect(two(WED10 - 2 * 864e5 - 10 * 36e5)).toEqual(["11-16T08:00", "11-16T09:00", "11-16T10:00"]);
    // Wednesday now 12 to 3; the next Wednesday closed.
    expect(two(WED10 - 10 * 36e5)).toEqual(["11-18T12:00", "11-18T13:00", "11-18T14:00", "11-18T15:00"]);
    expect(two(WED10 + 7 * 864e5 - 10 * 36e5)).toEqual([]);
  });

  it("takes only well-formed hours, and drops past dates", () => {
    const week = [null, null, null, [600, 1140], null, null, null];
    expect(cleanHours({ week, days: { "2026-11-01": null, "2026-11-20": [600, 720] } }, "2026-11-04")).toEqual({ week, days: { "2026-11-20": [600, 720] } });
    expect(cleanHours({ week: week.slice(1) }, "2026-11-04")).toBeNull();
    expect(cleanHours({ week: [[700, 600], ...week.slice(1)] }, "2026-11-04")).toBeNull();
    expect(cleanHours({ week: [[600, 610], ...week.slice(1)] }, "2026-11-04")).toBeNull();
    // One start only: the first is the last.
    expect(cleanHours({ week: [[1140, 1140], ...week.slice(1)] }, "2026-11-04")?.week[0]).toEqual([1140, 1140]);
    expect(cleanHours({ week, days: { tomorrow: null } }, "2026-11-04")).toBeNull();
  });

  it("follows the clocks across daylight time", () => {
    // Sunday 2026-03-08, the day PDT starts: 10 AM is UTC-7.
    expect(zoned(2026, 3, 8, 600)).toBe(Date.parse("2026-03-08T17:00:00Z"));
    expect(zoned(2026, 3, 7, 600)).toBe(Date.parse("2026-03-07T18:00:00Z"));
    expect(localIso(Date.parse("2026-03-08T17:00:00Z"), "Europe/Paris")).toBe("2026-03-08T18:00:00+01:00");
  });
});

describe("GET /api/slots", () => {
  const get = (q: string) => GET(new Request(`https://juliangigola.com/api/slots?${q}`));

  it("answers in Cal.com's shape, in the visitor's zone, minus busy time", async () => {
    vi.setSystemTime(NOW);
    busy = [{ start: "2026-11-18T18:00:00Z", end: "2026-11-18T19:00:00Z" }];
    const r = await (await get("slug=portraits&start=2026-11-18&end=2026-11-18&timeZone=America/New_York")).json();
    expect(r.status).toBe("success");
    expect(r.event).toMatchObject({ title: "Portraits", lengthInMinutes: 60, locations: [{ type: "attendeeDefined" }] });
    expect(r.data["2026-11-18"][0]).toEqual({ start: "2026-11-18T15:00:00-05:00", end: "2026-11-18T16:00:00-05:00" });
    expect(Object.keys(r.data)).toEqual(["2026-11-18"]);
    vi.useRealTimers();
  });

  it("refuses a bad request, and says when it is off or Google is down", async () => {
    expect((await get("slug=nope&start=2026-11-18&end=2026-11-18")).status).toBe(400);
    expect((await get("slug=portraits&start=x&end=2026-11-18")).status).toBe(400);
    expect((await get("slug=portraits&start=2026-11-18&end=2026-11-18&timeZone=Mars/Base")).status).toBe(400);
    vi.stubGlobal("fetch", async () => new Response("{}", { status: 500 }));
    expect((await get("slug=portraits&start=2026-11-18&end=2026-11-18")).status).toBe(502);
    ctx.env = {};
    expect((await get("slug=portraits&start=2026-11-18&end=2026-11-18")).status).toBe(503);
  });

  it("asks freeBusy in pieces Google accepts", async () => {
    await get("slug=music-call&start=2026-11-04&end=2027-03-04");
    expect(asked.length).toBeGreaterThan(1);
    for (const a of asked) expect(Date.parse(a.timeMax) - Date.parse(a.timeMin)).toBeLessThanOrEqual(60 * 864e5);
  });
});
