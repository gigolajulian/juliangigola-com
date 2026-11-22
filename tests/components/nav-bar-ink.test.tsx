import { describe, expect, it } from "vitest";
import { barInk } from "@/components/site/nav-ink";

describe("bar ink", () => {
  const light: [number, number, number] = [244, 244, 242], mid: [number, number, number] = [120, 110, 100];
  it("follows the worst word, not the most words", () => {
    // four stretches on a mid-tone photo, one on the light page: white wins the vote but fails on the page
    expect(barInk([mid, mid, mid, mid, light], null)).toBe("b");
  });
  it("keeps its ink until the other is clearly better", () => {
    const dark: [number, number, number] = [20, 20, 20];
    expect(barInk([dark], "w")).toBe("w");
    expect(barInk([light], "w")).toBe("b");
  });
});
