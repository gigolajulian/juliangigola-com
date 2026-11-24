import { describe, expect, it } from "vitest";
import { rubberband } from "@/lib/motion/rubberband";

describe("rubberband", () => {
  it("is zero at the edge and keeps the pull's direction", () => {
    expect(rubberband(0, 300)).toBe(0);
    expect(rubberband(-50, 300)).toBe(-rubberband(50, 300));
  });
  it("gives less than the pull and never reaches the size of the thing", () => {
    expect(rubberband(100, 300)).toBeLessThan(100);
    expect(rubberband(1e9, 300)).toBeLessThan(300);
    expect(rubberband(200, 300)).toBeGreaterThan(rubberband(100, 300));
  });
});
