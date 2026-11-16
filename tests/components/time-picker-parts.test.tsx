import { describe, expect, it } from "vitest";
import { clock, e164, iso, minutesOf } from "@/components/booking/time-picker-parts";

/* The picker's pure helpers (`components/booking/time-picker-parts.tsx`):
   the phone number sent to /api/book, and the clock it prints. */

describe("e164", () => {
  it("gives a US number without its country code +1", () => {
    expect(e164("(408) 555-0123")).toBe("+14085550123");
    expect(e164("408.555.0123")).toBe("+14085550123");
    expect(e164("1 408 555 0123")).toBe("+14085550123");
  });
  it("keeps a number written with +, 8 to 15 digits", () => {
    expect(e164("+44 20 7946 0958")).toBe("+442079460958");
    expect(e164(" +98 21 1234 5678")).toBe("+982112345678");
    expect(e164("+1234567")).toBe("");
    expect(e164("+1234567890123456")).toBe("");
  });
  it("refuses what is not a number it can dial", () => {
    expect(e164("")).toBe("");
    expect(e164("555-0123")).toBe("");
    expect(e164("2 408 555 0123")).toBe("");
    expect(e164("call me")).toBe("");
  });
});

describe("clock", () => {
  it("prints minutes after midnight as a 12-hour time", () => {
    expect(clock(0)).toEqual(["12:00", "AM"]);
    expect(clock(9 * 60 + 5)).toEqual(["9:05", "AM"]);
    expect(clock(12 * 60)).toEqual(["12:00", "PM"]);
    expect(clock(19 * 60 + 30)).toEqual(["7:30", "PM"]);
    expect(clock(23 * 60 + 59)).toEqual(["11:59", "PM"]);
  });
  it("wraps a time past midnight to the next morning", () => {
    expect(clock(24 * 60 + 15)).toEqual(["12:15", "AM"]);
  });
});

describe("iso and minutesOf", () => {
  it("reads a local date and a start's minutes", () => {
    expect(iso(new Date(2026, 10, 4))).toBe("2026-11-04");
    expect(minutesOf("2026-11-04T19:30:00-08:00")).toBe(1170);
  });
});
