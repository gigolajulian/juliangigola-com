import { afterEach, describe, expect, test, vi } from "vitest";
import { qflag } from "@/lib/flags/query";

const at = (search: string) => vi.stubGlobal("location", { search });
afterEach(() => vi.unstubAllGlobals());

describe("qflag", () => {
  test.each([
    ["?proofwall=0", "proofwall", "0", true],
    ["?a=1&proofwall=0", "proofwall", "0", true],
    ["", "proofwall", "0", false],
    ["?proofwall=1", "proofwall", "0", false],
    ["?intro=05", "intro", "0", true],
    ["?xintro=0", "intro", "0", false],
    ["?intro=2", "intro", "[12]", true],
    ["?intro=0", "intro", "[12]", false],
  ])("%s: %s=%s is %s", (search, name, value, want) => {
    at(search);
    expect(qflag(name, value)).toBe(want);
  });
});

test("no location: false", () => {
  expect(typeof location).toBe("undefined");
  expect(qflag("intro", "0")).toBe(false);
});
