import { describe, expect, it } from "vitest";
import { coverSizes, frameSizes } from "@/lib/frame-sizes";

/* The `sizes` strings a strip's photographs are fetched by (`lib/frame-sizes.ts`). */

describe("frame sizes", () => {
  it("scales a frame by its own proportions, two thirds on dense screens", () => {
    expect(frameSizes({ width: 3, height: 2 })).toBe(
      "(min-resolution: 2.5dppx) calc((100vh - 8rem) * 1.001), calc((100vh - 8rem) * 1.500)",
    );
  });

  it("gives a cover the full width on a phone", () => {
    const s = coverSizes({ width: 2, height: 3 });
    expect(s).toContain("calc((100vh - 10rem) * 0.667)");
    expect(s).toContain("calc((100vh - 10rem) * 0.445)");
    expect(s.endsWith(", 100vw")).toBe(true);
  });
});
