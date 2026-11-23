import { describe, expect, it } from "vitest";
import { masonry } from "@/components/v4/home/commissions";
import type { HomeFrame } from "@/lib/v4-home/data";

/* The phone sheet's two columns (`components/v4/home/commissions.tsx`): each
   frame goes to the shorter column by its ratio, the right column starting
   56/171 of a frame lower, and every frame keeps its index once. */

const frame = (r: number, i: number): HomeFrame => ({ src: `/work/x/${i}.jpg`, name: `F${i}`, meta: "", slug: "x", r });

describe("masonry", () => {
  it("starts on the left, then fills whichever column is shorter", () => {
    const [left, right] = masonry([1, 1, 1, 1].map(frame));
    expect(left.map((c) => c.i)).toEqual([0, 2]);
    expect(right.map((c) => c.i)).toEqual([1, 3]);
  });

  it("lets a tall frame hold its column while short ones go beside it", () => {
    const [left, right] = masonry([3, 0.5, 0.5, 0.5].map(frame));
    expect(left.map((c) => c.i)).toEqual([0]);
    expect(right.map((c) => c.i)).toEqual([1, 2, 3]);
  });

  it("places every frame exactly once and is empty for none", () => {
    const out = masonry([1.2, 0.8, 1.5, 0.7, 1].map(frame)).flat().map((c) => c.i).sort();
    expect(out).toEqual([0, 1, 2, 3, 4]);
    expect(masonry([])).toEqual([[], []]);
  });
});
