import { describe, expect, it } from "vitest";
import { gradYear } from "./grad-year";

describe("gradYear", () => {
  it("is this year through May, Pacific", () => {
    expect(gradYear(new Date("2026-01-10T12:00:00-08:00"))).toBe(2026);
    expect(gradYear(new Date("2026-05-31T12:00:00-07:00"))).toBe(2026);
  });
  it("reads Pacific, not UTC: May 31 in San Jose is already June 1 in UTC", () => {
    expect(gradYear(new Date("2026-06-01T03:00:00Z"))).toBe(2026);
  });
  it("is next year from June 1, Pacific", () => {
    expect(gradYear(new Date("2026-06-01T00:30:00-07:00"))).toBe(2027);
    expect(gradYear(new Date("2026-11-13T20:00:00-08:00"))).toBe(2027);
  });
});
