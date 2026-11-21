import { describe, expect, it } from "vitest";
import { tailHole } from "@/lib/sheet";
import type { Frame } from "@/lib/work-types";

const v = { width: 3, height: 4 } as Frame;
const w = { width: 3, height: 2 } as Frame;

describe("tailHole", () => {
  it("finds the cells a short last row leaves", () => {
    expect(tailHole([v, v, v, v])).toEqual({ row: 2, col: 2, span: 2 });
    expect(tailHole([v, v])).toEqual({ row: 1, col: 3, span: 1 });
  });
  it("gives a horizontal the whole row", () => {
    // Each w fills a row of its own; the v opens the third.
    expect(tailHole([w, w, v])).toEqual({ row: 3, col: 2, span: 2 });
    expect(tailHole([w, v, v, v, v])).toEqual({ row: 3, col: 2, span: 2 });
  });
  it("has none when the rows are full or there are no frames", () => {
    expect(tailHole([w])).toBeNull();
    expect(tailHole([v, v, v, w])).toBeNull();
    expect(tailHole([])).toBeNull();
  });
});
