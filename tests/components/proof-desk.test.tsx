import { afterEach, describe, expect, it, vi } from "vitest";
import { api, cardCrop, closed, cropAt, status, type Row } from "@/lib/proofs/desk";

afterEach(() => vi.unstubAllGlobals());

const proof = (over: Partial<Row> = {}): Row => ({
  token: "tk1",
  name: "Nov 1 portraits",
  email: "ana@example.com",
  included: 10,
  price: 15,
  days: 14,
  createdAt: "2026-11-01T20:00:00Z",
  frames: [{ id: "f1", file: "DSC1.jpg", w: 100, h: 150 } as never],
  selects: [],
  notes: {},
  views: 0,
  url: "https://juliangigola.com/proof/tk1",
  ...over,
});

const answer = (body: unknown, ok = true) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })),
  );

describe("proof helpers", () => {
  it("closed and status read the gallery state", () => {
    expect(closed(proof({ closesAt: "2000-01-01T00:00:00Z" }))).toBe(true);
    expect(closed(proof())).toBe(false);
    expect(status(proof({ sentAt: "2026-11-02T00:00:00Z" }))).toBe("Sent");
    expect(status(proof({ sentAt: "x", closesAt: "2000-01-01T00:00:00Z" }))).toBe("Sent · closed");
  });

  it("api throws the server error", async () => {
    answer({ error: "nope" }, false);
    await expect(api({ query: "?list" })).rejects.toThrow("nope");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/proof?list");
  });
});

describe("share-card crop", () => {
  // The card's photo is 1200 x 945.
  it("crops a portrait frame top to bottom at full width", () => {
    const f = { id: "f1", w: 1200, h: 1800 };
    expect(cardCrop(f, 0)).toEqual({ id: "f1", x: 0, y: 0, w: 1200 });
    expect(cardCrop(f, 1)).toEqual({ id: "f1", x: 0, y: 855, w: 1200 });
    expect(cropAt(f, cardCrop(f, 0.25)!)).toBeCloseTo(0.25, 2);
  });
  it("crops a wide frame left to right at full height", () => {
    const f = { id: "f2", w: 3000, h: 945 };
    expect(cardCrop(f, 1)).toEqual({ id: "f2", x: 1800, y: 0, w: 1200 });
    expect(cropAt(f, cardCrop(f, 0.5)!)).toBeCloseTo(0.5, 2);
  });
  it("has no crop without a size", () => expect(cardCrop({ id: "f3", w: 0, h: 0 }, 0.5)).toBeNull());
});
