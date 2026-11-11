import { describe, expect, it, vi } from "vitest";
import { paidFor } from "@/lib/proof-submit";
import { cardPrice, cleanNotes, coverFrame, cleanSelects, cleanSettings, extras, isOpen, isToken, newToken, owed, stage } from "@/lib/proofs";

const frames = ["a", "b", "c"].map((id) => ({ id, file: `${id}.jpg`, w: 1, h: 1 }));

describe("proofs", () => {
  it("prices only the frames past the included ones", () => {
    expect(extras(12, 10, 15)).toEqual({ n: 2, dollars: 30 });
    expect(extras(4, 10, 15)).toEqual({ n: 0, dollars: 0 });
  });
  it("charges a reopened gallery only for new extras", () => {
    const base = { included: 10, price: 15, selects: Array.from({ length: 13 }, (_, i) => String(i)) };
    expect(owed({ ...base, paid: undefined })).toEqual({ n: 3, balance: 0, cents: 4500 });
    expect(owed({ ...base, paid: { session: "s", amount: 3000, at: "" } })).toEqual({ n: 1, balance: 0, cents: 1500 });
  });
  it("puts the shoot balance before extras, and counts it paid once", () => {
    const base = { included: 10, price: 15, balance: 200, selects: Array.from({ length: 12 }, (_, i) => String(i)) };
    expect(owed({ ...base, paid: undefined })).toEqual({ n: 2, balance: 20000, cents: 23000 });
    expect(owed({ ...base, paid: { session: "s", amount: 23000, at: "" } })).toEqual({ n: 0, balance: 0, cents: 0 });
    expect(owed({ ...base, selects: [...base.selects, "x"], paid: { session: "s", amount: 23000, at: "" } })).toEqual({ n: 1, balance: 0, cents: 1500 });
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
  it("takes the watermark switch as a boolean, ignores anything else", () => {
    expect(cleanSettings({ watermark: true })).toEqual({ watermark: true });
    expect(cleanSettings({ watermark: "false" })).toEqual({ watermark: false });
    expect(cleanSettings({ watermark: 1 })).toEqual({});
  });
  it("previews the first frame only when watermarked and open", () => {
    expect(coverFrame({ frames, watermark: true })).toEqual(frames[0]);
    expect(coverFrame({ frames, watermark: false })).toBeNull();
    expect(coverFrame({ frames, watermark: true, closesAt: "2020-01-01T00:00:00Z" })).toBeNull();
    expect(coverFrame({ frames: [], watermark: true })).toBeNull();
  });
  it("is open until closesAt", () => {
    expect(isOpen({ closesAt: undefined })).toBe(true);
    expect(isOpen({ closesAt: "2020-01-01T00:00:00Z" })).toBe(false);
  });
});

describe("proof activity log", () => {
  it("logs opens once per device and diffs picks into pick and unpick", async () => {
    const { track, device } = await import("@/lib/proofs");
    let v = track(undefined, "t1", { kind: "open", device: "iPhone · Safari", place: "San Jose, CA, US", name: "Maya" });
    expect(v.name).toBe("Maya");
    v = track(v, "t2", { picks: ["a", "b"] });
    v = track(v, "t3", { picks: ["b", "c"] });
    v = track(v, "t4", { kind: "open", device: "iPhone · Safari", looks: { a: 500_000 }, seconds: 9999 });
    expect(v.visits).toBe(2);
    expect(v.devices).toEqual(["iPhone · Safari"]);
    expect(v.picks).toEqual(["b", "c"]);
    expect(v.events.map((e) => `${e.kind}${e.id ?? ""}`)).toEqual(["open", "picka", "pickb", "pickc", "unpicka", "open"]);
    expect(v.looks.a).toBe(120_000);
    expect(v.seconds).toBe(120);
    expect(device("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe("iPhone · Safari");
  });
});

describe("bank payments", () => {
  const p = { token: "t", name: "n", included: 10, price: 15, days: 14, createdAt: "", frames: [], selects: Array.from({ length: 12 }, (_, i) => String(i)), notes: {}, views: 0 };
  const reply = (body: unknown) => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body)));
  it("locks on an accepted bank payment and marks it settling", async () => {
    const f = reply({ status: "complete", payment_status: "unpaid", amount_total: 3000, metadata: { proof: "t" } });
    expect(await paidFor("sk_test_x", p, "cs_test_B")).toMatchObject({ amount: 3000, pending: true });
    f.mockRestore();
  });
  it("clears or drops a settling payment", async () => {
    const { settle } = await import("@/lib/proof-submit");
    const q = { ...p, paid: { session: "cs_test_B", amount: 3000, at: "", pending: true } };
    let f = reply({ payment_status: "paid", amount_total: 3000 });
    expect((await settle("sk_test_x", q))?.paid).toMatchObject({ amount: 3000, pending: undefined });
    f.mockRestore();
    f = reply({ payment_status: "unpaid", amount_total: 3000, payment_intent: { status: "requires_payment_method" } });
    expect((await settle("sk_test_x", q))?.paid).toMatchObject({ amount: 0, failed: true });
    f.mockRestore();
  });
});

describe("card price", () => {
  it("is the bank amount plus Stripe's card fee, rounded up, so the card net never falls below it", () => {
    expect(cardPrice(0)).toBe(0);
    expect(cardPrice(15000)).toBe(15500);
    for (let c = 100; c <= 500000; c += 100) {
      const card = cardPrice(c);
      expect(card % 100).toBe(0);
      expect(card * 0.971 - 30).toBeGreaterThanOrEqual(c);
    }
  });
});
