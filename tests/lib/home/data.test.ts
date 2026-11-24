import { describe, expect, it } from "vitest";
import { CHIP_TYPE, QUOTE_OPTS } from "@/lib/home/data";
import { clamp, progress, smooth, progressBetween } from "@/components/home/motion/engine";
import { SHOOT_TYPES } from "@/lib/leads/enquiry";

/* The server files any type it does not know as "other" without a word, so a renamed chip or a mistyped
   shoot type would lose the lead's category quietly. */
describe("v4 inquiry chips", () => {
  it("every chip on a By quote option has a shoot type", () => {
    expect(QUOTE_OPTS.flatMap((o) => o.chips).filter((c) => !CHIP_TYPE[c])).toEqual([]);
  });

  it("every chip's shoot type is one the inbox knows", () => {
    expect(Object.values(CHIP_TYPE).filter((t) => !(SHOOT_TYPES as readonly string[]).includes(t))).toEqual([]);
  });
});

describe("v4 motion math", () => {
  it("clamp holds a value inside its range, 0 to 1 by default", () => {
    expect([clamp(-1), clamp(0.4), clamp(2), clamp(5, 1, 3), clamp(0, 1, 3)]).toEqual([0, 0.4, 1, 3, 1]);
  });

  it("smooth eases 0 to 1 and keeps its ends and middle", () => {
    expect([smooth(0), smooth(0.5), smooth(1)]).toEqual([0, 0.5, 1]);
    expect(smooth(0.25)).toBeLessThan(0.25);
  });

  it("span runs the other way when a is above b", () => {
    expect([progressBetween(1.2, 1, 0), progressBetween(1, 1, 0), progressBetween(0.5, 1, 0), progressBetween(-1, 1, 0)]).toEqual([0, 0, 0.5, 1]);
  });

  it("span maps a to b onto 0 to 1 and clamps outside it", () => {
    expect([progressBetween(0.2, 0.25, 1), progressBetween(0.25, 0.25, 1), progressBetween(0.625, 0.25, 1), progressBetween(2, 0.25, 1)]).toEqual([0, 0, 0.5, 1]);
  });

  it("progress runs a held section 0 to 1 through its hold", () => {
    const h = 3000, vh = 900;
    expect([progress(100, h, vh, true), progress(0, h, vh, true), progress(-(h - vh) / 2, h, vh, true), progress(-(h - vh), h, vh, true), progress(-h, h, vh, true)]).toEqual([0, 0, 0.5, 1, 1]);
  });

  it("progress on a held section no taller than the screen floors the divisor at 1, never NaN", () => {
    expect([progress(0, 900, 900, true), progress(-0.5, 900, 900, true), progress(-5, 600, 900, true), progress(10, 0, 900, true), progress(-10, 0, 900, true)]).toEqual([0, 0.5, 1, 0, 1]);
  });

  it("progress runs a section without a hold 0 to 1 as it crosses the screen", () => {
    const h = 1200, vh = 900;
    expect([progress(1000, h, vh, false), progress(vh, h, vh, false), progress((vh - h) / 2, h, vh, false), progress(-h, h, vh, false), progress(-2 * h, h, vh, false)]).toEqual([0, 0, 0.5, 1, 1]);
    expect([progress(vh, 0, vh, false), progress(0, 0, vh, false), progress(-1, 0, vh, false)]).toEqual([0, 1, 1]);
  });
});
