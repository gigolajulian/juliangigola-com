import { describe, expect, it } from "vitest";
import { secretJson } from "@/lib/secrets";

describe("secretJson", () => {
  it("parses a JSON secret", () => {
    expect(secretJson<{ a: number }>('{"a":1}', "X")).toEqual({ a: 1 });
  });

  it("names the secret but never quotes it when it is not JSON", () => {
    const err = (() => { try { secretJson("hunter2-not-json", "GCAL_OAUTH"); } catch (e) { return String(e); } })();
    expect(err).toBe("Error: GCAL_OAUTH is not valid JSON");
    expect(err).not.toContain("hunter2");
  });
});
