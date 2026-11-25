import { describe, expect, it } from "vitest";
import { barInk } from "@/components/site/nav-ink";

type RGB = [number, number, number];
describe("bar ink", () => {
  const light: RGB = [244, 244, 242],
    dark: RGB = [20, 25, 40],
    mid: RGB = [150, 140, 130];
  it("takes the ink that fails the fewest spots", () => {
    expect(barInk([dark, dark, dark, light], null)).toBe("w");
    expect(barInk([light, light, mid, dark], null)).toBe("b");
  });
  it("keeps its ink until the other fails clearly fewer spots", () => {
    expect(barInk([dark, light], "b")).toBe("b");
    expect(barInk([dark, dark, dark, light], "b")).toBe("w");
  });
});
