import { describe, expect, it } from "vitest";
import { BOOKING_MOVES, DEAL, LANDSCAPE, MIDDLE, PHONE, SHORT, SIDEWAYS, SLOTS, UPRIGHT, middleVars } from "@/lib/cover-slots";

/* The cover's hand-placed card layouts (`lib/cover-slots.ts`). */

describe("cover layouts", () => {
  it("places every card in every layout", () => {
    for (const layout of [UPRIGHT, LANDSCAPE, PHONE, SIDEWAYS, SHORT]) expect(layout).toHaveLength(SLOTS.length);
  });

  it("deals each place once", () => {
    expect([...DEAL].sort((a, b) => a - b)).toEqual(SLOTS.map((_, i) => i));
  });

  it("moves only cards that exist", () => {
    for (const moves of Object.values(BOOKING_MOVES))
      for (const i of Object.keys(moves)) expect(Number(i)).toBeLessThan(SLOTS.length);
  });
});

describe("middleVars", () => {
  it("names a variable per shape and size", () => {
    const vars = middleVars(MIDDLE);
    expect(vars["--m-phone-name"]).toBe(String(MIDDLE.phone.name));
    expect(Object.keys(vars)).toHaveLength(Object.keys(MIDDLE).length * 6);
  });
});
