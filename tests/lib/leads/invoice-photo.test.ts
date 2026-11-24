import { describe, expect, it } from "vitest";
// Relative imports: the coverage scanner resolves `@/` under src/, which this repo does not have.
import { COL, coverFit } from "../../../lib/leads/invoice-photo";

/* Design B's photo column: the photo covers the box, `z` zooms past cover,
   `x`/`y` slide it like CSS object-position. The canvas half is browser only. */

describe("coverFit", () => {
  it("covers the box: a wide photo fills the height and is cropped at the sides", () => {
    const p = coverFit(3000, 2000, 200, 400, { x: 0.5, y: 0.5, z: 1 });
    expect(p.h).toBe(400);
    expect(p.w).toBe(600);
    expect(p.left).toBe(-200);
    expect(p.top).toBeCloseTo(0);
  });

  it("slides like object-position: x 0 pins the left edge, x 1 the right", () => {
    expect(coverFit(3000, 2000, 200, 400, { x: 0, y: 0.5, z: 1 }).left).toBeCloseTo(0);
    expect(coverFit(3000, 2000, 200, 400, { x: 1, y: 0.5, z: 1 }).left).toBe(-400);
  });

  it("zooms past cover around the chosen point", () => {
    const p = coverFit(1000, 1000, 100, 100, { x: 0.5, y: 0.25, z: 2 });
    expect([p.w, p.h]).toEqual([200, 200]);
    expect(p.left).toBe(-50);
    expect(p.top).toBe(-25);
  });

  it("the column is 41% of A4's width at full height, in points", () => {
    expect(COL.w).toBeCloseTo(243.93, 2);
    expect(COL.h).toBe(841.92);
  });
});
