import { afterEach, describe, expect, it, vi } from "vitest";
import { cn, isEmail, logged, pad } from "@/lib/utils";
import { asRecord } from "@/lib/json";
import { softItem, wallItem } from "@/lib/work/wall-tile";

/* Small shared helpers and tuned values. */

afterEach(() => vi.unstubAllGlobals());

describe("cn", () => {
  it("joins classes and drops falsy ones", () => {
    expect(cn("a", false, null, "b")).toBe("a b");
  });
});

describe("pad", () => {
  it("pads to two digits", () => {
    expect([pad(7), pad(12), pad(0)]).toEqual(["07", "12", "00"]);
  });
});

describe("wall tiles", () => {
  const tile = { src: "/work/zoe/16.jpg", title: "Zoe", href: "/portfolio/zoe" };
  it("send two small copies, the image the larger", () => {
    const w = wallItem(tile);
    expect(w).toMatchObject({ title: "Zoe", href: "/portfolio/zoe" });
    expect(w.srcSet).toMatch(/ 320w, .+ 640w$/);
    expect(w.srcSet!.split(", ")[1].startsWith(w.image)).toBe(true);
  });
  it("send half the pixels behind a frosted card", () => {
    const s = softItem(tile);
    expect(s.srcSet).toMatch(/ 160w, .+ 320w$/);
    expect(s.srcSet!.split(", ")[1].startsWith(s.image)).toBe(true);
  });
});

describe("logged", () => {
  it("logs the labels and the error as text, then gives undefined", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await Promise.reject(new Error("boom")).catch(logged("a", "b"))).toBeUndefined();
    expect(err).toHaveBeenCalledWith("a", "b", "Error: boom");
    err.mockRestore();
  });
});

describe("isEmail and asRecord", () => {
  it("checks an address string, and reads anything else as an empty record", () => {
    expect(isEmail(" kai@x.co ")).toBe(true);
    expect(isEmail("kai")).toBe(false);
    expect(isEmail(`${"a".repeat(200)}@x.co`)).toBe(false);
    expect(asRecord({ a: 1 })).toEqual({ a: 1 });
    expect(asRecord(null)).toEqual({});
    expect(asRecord(["a"])).toEqual({});
    expect(asRecord("a")).toEqual({});
  });
});
