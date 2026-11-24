import { describe, expect, it } from "vitest";
import { clockLabel } from "@/lib/booking/clock";

describe("clockLabel", () => {
  it("prints minutes after midnight on a 12 hour clock", () => {
    expect(clockLabel(0)).toBe("12:00 AM");
    expect(clockLabel(9 * 60 + 5)).toBe("9:05 AM");
    expect(clockLabel(12 * 60)).toBe("12:00 PM");
    expect(clockLabel(23 * 60 + 59)).toBe("11:59 PM");
  });
  it("wraps a time past midnight to the next morning", () => {
    expect(clockLabel(24 * 60 + 15)).toBe("12:15 AM");
  });
});
