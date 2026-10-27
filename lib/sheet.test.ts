import { describe, expect, it } from "vitest";
import { tailHole } from "./sheet";
import type { Frame } from "./work-types";

const v = { width: 3, height: 4 } as Frame;
const w = { width: 3, height: 2 } as Frame;

describe("tailHole", () => {
  it("finds the cells a short last row leaves", () => {
    expect(tailHole([v, v, v, v])).toEqual({ row: 2, col: 2, span: 2 });
    expect(tailHole([w])).toEqual({ row: 1, col: 3, span: 1 });
  });
  it("packs densely: a vertical fills the cell a horizontal left", () => {
    // w lands at 1-2, the second w opens row 2, the v backfills row 1.
    expect(tailHole([w, w, v])).toEqual({ row: 2, col: 3, span: 1 });
  });
  it("has none when the rows are full or there are no frames", () => {
    expect(tailHole([w, v, v, v, v])).toBeNull();
    expect(tailHole([])).toBeNull();
  });
});
