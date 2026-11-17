import { describe, expect, it } from "vitest";
import { CHIP_TYPE, QUOTE_OPTS } from "@/components/v3/mt/data";
import { clamp, smooth, span } from "@/components/v3/mt/motion/engine";
import { SHOOT_TYPES } from "@/lib/inbox";

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

  it("span maps a to b onto 0 to 1 and clamps outside it", () => {
    expect([span(0.2, 0.25, 1), span(0.25, 0.25, 1), span(0.625, 0.25, 1), span(2, 0.25, 1)]).toEqual([0, 0, 0.5, 1]);
  });
});
