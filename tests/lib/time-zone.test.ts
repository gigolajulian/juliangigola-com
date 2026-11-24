import { describe, expect, it } from "vitest";
import { pacificFormat } from "@/lib/time-zone";

describe("pacificFormat", () => {
  it("formats in Julian's time, whatever the machine's zone", () => {
    // 03:30 UTC on Nov 25 is still Nov 24 in Los Angeles.
    expect(
      pacificFormat({ month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date("2026-11-25T03:30:00Z")),
    ).toBe("Nov 24, 7:30 PM");
  });
});
