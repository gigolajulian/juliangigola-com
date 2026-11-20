import { afterEach, expect, test } from "vitest";
import { flipMs } from "@/components/v3/mt/motion/root-attrs";

afterEach(() => document.documentElement.removeAttribute("data-mt-flip"));

test("flipMs reads html[data-mt-flip], 0 when it is missing", () => {
  expect(flipMs()).toBe(0);
  document.documentElement.setAttribute("data-mt-flip", "1300");
  expect(flipMs()).toBe(1300);
  document.documentElement.removeAttribute("data-mt-flip");
  expect(flipMs()).toBe(0);
});
