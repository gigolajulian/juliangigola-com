import { describe, expect, it } from "vitest";
import { localDayKey } from "@/components/booking/flow";
import { monthCells, weekFrom } from "@/components/booking/picker/dates";

/* The picker's pure date helpers (`components/booking/picker/dates.ts`). */

const keys = (ds: (Date | null)[]) => ds.map((d) => (d ? localDayKey(d) : null));

describe("weekFrom", () => {
  it("starts today when the anchor is before today", () => {
    const week = weekFrom(new Date(2026, 10, 10, 15), new Date(2026, 10, 18, 9));
    expect(localDayKey(week[0])).toBe("2026-11-18");
    expect(week[0].getHours()).toBe(0);
  });
  it("gives seven days in a row across a month end", () => {
    const week = weekFrom(new Date(2026, 10, 28), new Date(2026, 10, 1));
    expect(keys(week)).toEqual(["2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"]);
  });
});

describe("monthCells", () => {
  it("pads the first row to the 1st's weekday, Sunday first", () => {
    const cells = monthCells(new Date(2026, 1, 14)); // Feb 2026 starts on a Sunday
    expect(cells).toHaveLength(28);
    expect(localDayKey(cells[0]!)).toBe("2026-02-01");
    const april = monthCells(new Date(2026, 3, 30)); // Apr 2026 starts on a Wednesday
    expect(keys(april.slice(0, 4))).toEqual([null, null, null, "2026-04-01"]);
    expect(april).toHaveLength(33);
    expect(localDayKey(april.at(-1)!)).toBe("2026-04-30");
  });
});
