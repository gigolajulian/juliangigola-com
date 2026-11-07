import { describe, expect, it, vi } from "vitest";
import { paidFor } from "@/lib/proof-submit";
import { cleanNotes, cleanSelects, cleanSettings, extras, isOpen, isToken, newToken, owed, stage } from "@/lib/proofs";

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
  it("reads the pipeline stage", () => {
    expect(stage({})).toBe("Draft");
    expect(stage({ sentAt: "x", firstViewAt: "x" })).toBe("Opened");
    expect(stage({ sentAt: "x", submittedAt: "x" })).toBe("Selects in");
    expect(stage({ sentAt: "x", submittedAt: "x", paid: { session: "s", amount: 1500, at: "x" } })).toBe("Paid");
    expect(stage({ submittedAt: "x", pulledAt: "x" })).toBe("In Lightroom");
  });
  it("never takes a Checkout session that was already counted", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const p = { token: "t", name: "n", included: 10, price: 15, days: 14, createdAt: "", frames: [], selects: Array.from({ length: 12 }, (_, i) => String(i)), notes: {}, views: 0, paid: { session: "cs_test_A", amount: 1500, at: "" } };
    expect(await paidFor("sk_test_x", p, "cs_test_A")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    fetch.mockRestore();
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
