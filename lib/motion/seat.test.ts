import { describe, expect, it } from "vitest";
import { chooseSeat, nearestSeat } from "./seat";
import { projectThrow } from "./throw";

/* Five full-width screens on a 1024 window: centres at 512, 1536, ... and
   the middle of the window is the scroll position plus 512. */
const W = 1024;
const CENTRES = [0, 1, 2, 3, 4].map((i) => i * W + W / 2);
const middle = (scroll: number) => scroll + W / 2;

describe("nearestSeat", () => {
  it("finds the screen under the middle of the window", () => {
    expect(nearestSeat(CENTRES, middle(0))).toBe(0);
    expect(nearestSeat(CENTRES, middle(2 * W))).toBe(2);
    expect(nearestSeat(CENTRES, middle(2 * W + 400))).toBe(2);
    expect(nearestSeat(CENTRES, middle(2 * W + 600))).toBe(3);
  });

  it("gives a tie to the earlier screen", () => {
    expect(nearestSeat(CENTRES, middle(W / 2))).toBe(0);
  });

  it("answers the end screens past either end", () => {
    expect(nearestSeat(CENTRES, middle(-5000))).toBe(0);
    expect(nearestSeat(CENTRES, middle(50000))).toBe(4);
  });

  it("answers 0 for an empty strip", () => {
    expect(nearestSeat([], 300)).toBe(0);
  });
});

describe("chooseSeat", () => {
  it("keeps the landing when it is within one of the start", () => {
    expect(chooseSeat(2, 2, 5)).toBe(2);
    expect(chooseSeat(3, 2, 5)).toBe(3);
    expect(chooseSeat(1, 2, 5)).toBe(1);
  });

  it("goes no further than one screen from where the finger went down", () => {
    expect(chooseSeat(4, 1, 5)).toBe(2);
    expect(chooseSeat(0, 3, 5)).toBe(2);
  });

  it("stays inside the strip at either end", () => {
    expect(chooseSeat(-1, 0, 5)).toBe(0);
    expect(chooseSeat(5, 4, 5)).toBe(4);
    expect(chooseSeat(0, 0, 5)).toBe(0);
    expect(chooseSeat(4, 4, 5)).toBe(4);
  });

  it("stays on the only screen of a strip of one", () => {
    expect(chooseSeat(1, 0, 1)).toBe(0);
  });
});

describe("a lift, end to end", () => {
  // The strip's speed `sv` is against the finger: px per ms.
  const lift = (scroll: number, sv: number, downSeat: number) =>
    chooseSeat(nearestSeat(CENTRES, middle(projectThrow(scroll, sv))), downSeat, CENTRES.length);

  it("lands a slow drag on the nearest screen", () => {
    // Dragged 300px on from screen 1 and let go almost still: back to 1.
    expect(lift(W + 300, 0.05, 1)).toBe(1);
    // Dragged 700px on and let go almost still: on to 2.
    expect(lift(W + 700, 0.05, 1)).toBe(2);
  });

  it("carries a quick swipe on to the next screen", () => {
    // 200px on at 1.2px/ms projects about 600px further: screen 2.
    expect(lift(W + 200, 1.2, 1)).toBe(2);
  });

  it("holds a hard flick to one screen", () => {
    // 14px/ms projects about 7000px, four screens; the strip goes one.
    expect(lift(W + 200, 14, 1)).toBe(2);
    expect(lift(3 * W - 200, -14, 3)).toBe(2);
  });

  it("follows a reversed throw back", () => {
    // Dragged 400px on, then flung back the other way.
    expect(lift(W + 400, -2.5, 1)).toBe(0);
  });

  it("stays on an end screen when thrown past it", () => {
    expect(lift(0, -3, 0)).toBe(0);
    expect(lift(4 * W, 3, 4)).toBe(4);
  });
});
