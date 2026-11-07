import { describe, expect, it } from "vitest";
import { cleanNotes, cleanSelects, cleanSettings, extras, isOpen, isToken, newToken, owed } from "@/lib/proofs";

const frames = ["a", "b", "c"].map((id) => ({ id, file: `${id}.jpg`, w: 1, h: 1 }));

describe("proofs", () => {
  it("prices only the frames past the included ones", () => {
    expect(extras(12, 10, 15)).toEqual({ n: 2, dollars: 30 });
    expect(extras(4, 10, 15)).toEqual({ n: 0, dollars: 0 });
  });
  it("charges a reopened gallery only for new extras", () => {
    const base = { included: 10, price: 15, selects: Array.from({ length: 13 }, (_, i) => String(i)) };
    expect(owed({ ...base, paid: undefined })).toEqual({ n: 3, cents: 4500 });
    expect(owed({ ...base, paid: { session: "s", amount: 3000, at: "" } })).toEqual({ n: 1, cents: 1500 });
  });
  it("makes 16-character base62 tokens", () => {
    const t = newToken();
    expect(isToken(t)).toBe(true);
    expect(new Set(Array.from({ length: 200 }, newToken)).size).toBe(200);
  });
  it("keeps selects to real frames, once each, in pick order", () => {
    expect(cleanSelects(["c", "x", "a", "c", 3], frames)).toEqual(["c", "a"]);
    expect(cleanSelects("a", frames)).toEqual([]);
  });
  it("keeps notes only on selected frames", () => {
    expect(cleanNotes({ a: " warmer ", b: "x", c: "  " }, ["a", "c"])).toEqual({ a: "warmer" });
  });
  it("clamps settings", () => {
    expect(cleanSettings({ price: 15000, included: -2, days: "14", email: "nope" })).toEqual({ price: 500, included: 0, days: 14, email: undefined });
  });
  it("is open until closesAt", () => {
    expect(isOpen({ closesAt: undefined })).toBe(true);
    expect(isOpen({ closesAt: "2020-01-01T00:00:00Z" })).toBe(false);
  });
});
