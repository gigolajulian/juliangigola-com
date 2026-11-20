import { afterEach, describe, expect, test, vi } from "vitest";
import { qflag, qvalue } from "@/lib/v4-home/flags";

const at = (search: string) => vi.stubGlobal("location", { search });
afterEach(() => vi.unstubAllGlobals());

describe("qflag", () => {
  test.each([
    ["?mtpin=0", "mtpin", "0", true],
    ["?a=1&mtpin=0", "mtpin", "0", true],
    ["", "mtpin", "0", false],
    ["?mtpin=1", "mtpin", "0", false],
    ["?mtpin=05", "mtpin", "0", true],
    ["?xmtpin=0", "mtpin", "0", false],
    ["?intro=2", "intro", "[12]", true],
    ["?intro=0", "intro", "[12]", false],
  ])("%s: %s=%s is %s", (search, name, value, want) => {
    at(search);
    expect(qflag(name, value)).toBe(want);
  });
});

describe("qvalue", () => {
  test("a pattern", () => {
    at("?mttp=-flip,-sink");
    expect(qvalue("mttp", "[\\w,-]+")).toBe("-flip,-sink");
  });
  test("the default word", () => {
    at("?mtsnap=near&x");
    expect(qvalue("mtsnap")).toBe("near");
  });
  test("absent", () => {
    at("?a=1");
    expect(qvalue("mtsnap")).toBeUndefined();
  });
});

test("no location: false and undefined", () => {
  expect(typeof location).toBe("undefined");
  expect(qflag("mtpin", "0")).toBe(false);
  expect(qvalue("mtsnap")).toBeUndefined();
});
