import { describe, expect, it } from "vitest";
import { parseOr } from "./json";

describe("parseOr", () => {
  it("parses good JSON, falls back on missing or malformed", () => {
    expect(parseOr('{"a":1}', null)).toEqual({ a: 1 });
    expect(parseOr(null, "x")).toBe("x");
    expect(parseOr("{oops", "x")).toBe("x");
  });
});
