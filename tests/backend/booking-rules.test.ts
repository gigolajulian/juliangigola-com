import { describe, expect, it } from "vitest";
import { DEFAULT_HOURS, EVENTS, cleanHours, duration, ownOnServer, refundable, windowOn } from "@/lib/booking-rules";

/* The site's own booking rules (`lib/booking-rules.ts`): hours, the
   refund window and how a length is written. */

const week = DEFAULT_HOURS.week;

describe("duration", () => {
  it("writes minutes under two hours and hours from two up", () => {
    expect(duration(45)).toBe("45 minutes");
    expect(duration(90)).toBe("90 minutes");
    expect(duration(120)).toBe("2 hours");
    expect(duration(180)).toBe("3 hours");
  });
});

describe("windowOn", () => {
  it("reads the week unless the date has its own entry", () => {
    const h = { week, days: { "2026-11-11": null, "2026-11-10": [600, 720] as const } };
    expect(windowOn(h, "2026-11-12", 4)).toEqual(week[4]);
    expect(windowOn(h, "2026-11-11", 3)).toBeNull();
    expect(windowOn(h, "2026-11-10", 2)).toEqual([600, 720]);
    expect(windowOn(DEFAULT_HOURS, "2026-11-10", 1)).toBeNull();
  });
});

describe("cleanHours", () => {
  it("keeps a well formed week and drops dates before today", () => {
    const h = cleanHours({ week, days: { "2026-11-01": null, "2026-11-20": [600, 900] } }, "2026-11-10");
    expect(h).toEqual({ week, days: { "2026-11-20": [600, 900] } });
  });

  it("refuses a week that is not seven days, off the quarter hour, reversed or past midnight", () => {
    expect(cleanHours({ week: week.slice(0, 6) }, "2026-11-10")).toBeNull();
    expect(cleanHours({ week: [...week.slice(0, 6), [600, 610]] }, "2026-11-10")).toBeNull();
    expect(cleanHours({ week: [...week.slice(0, 6), [900, 600]] }, "2026-11-10")).toBeNull();
    expect(cleanHours({ week: [...week.slice(0, 6), [0, 1455]] }, "2026-11-10")).toBeNull();
    expect(cleanHours(null, "2026-11-10")).toBeNull();
  });

  it("refuses a bad date key or a bad day window", () => {
    expect(cleanHours({ week, days: { "11/20/2026": null } }, "2026-11-10")).toBeNull();
    expect(cleanHours({ week, days: { "2026-11-20": [600] } }, "2026-11-10")).toBeNull();
  });
});

describe("refundable", () => {
  const now = Date.parse("2026-11-10T18:00:00Z");
  it("needs a deposit and 48 hours before the start", () => {
    expect(refundable({ intent: "pi_1", start: "2026-11-12T18:00:00Z" }, now)).toBe(true);
    expect(refundable({ intent: "pi_1", start: "2026-11-12T17:59:00Z" }, now)).toBe(false);
    expect(refundable({ start: "2026-12-12T18:00:00Z" }, now)).toBe(false);
  });

  it("judges a moved session by the earlier of its first and new start", () => {
    expect(refundable({ intent: "pi_1", start: "2026-12-01T18:00:00Z", firstStart: "2026-11-11T18:00:00Z" }, now)).toBe(false);
    expect(refundable({ intent: "pi_1", start: "2026-11-11T18:00:00Z", firstStart: "2026-12-01T18:00:00Z" }, now)).toBe(false);
  });
});

describe("EVENTS and ownOnServer", () => {
  it("gives every event a title, a positive length and a notice", () => {
    for (const r of Object.values(EVENTS)) {
      expect(r.title).toBeTruthy();
      expect(r.length).toBeGreaterThan(0);
      expect(r.notice).toBeGreaterThan(0);
    }
  });

  it("runs the own engine when the Worker or the request says so", () => {
    expect(ownOnServer({ BOOKING_ENGINE: "own" })).toBe(true);
    expect(ownOnServer({}, "own")).toBe(true);
    expect(ownOnServer({ BOOKING_ENGINE: "cal" }, "cal")).toBe(false);
  });
});
