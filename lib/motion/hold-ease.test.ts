import { expect, test } from "vitest";
import { holdEase, holdUnease } from "./hold-ease";

test("holdUnease undoes holdEase, and the ends stay put", () => {
  for (const p of [0, 0.1, 0.37, 0.5, 0.9, 1]) expect(holdUnease(holdEase(p))).toBeCloseTo(p, 4);
  expect(holdEase(0)).toBe(0);
  expect(holdEase(1)).toBeCloseTo(1, 10);
});
