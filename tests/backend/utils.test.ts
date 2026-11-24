import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { cn, pad, rubberband, sha256Hex } from "@/lib/utils";
import { softItem, wallItem } from "@/lib/work/wall-tile";

/* Small shared helpers and tuned values. */

afterEach(() => vi.unstubAllGlobals());

describe("rubberband", () => {
  it("is zero at the edge and keeps the pull's direction", () => {
    expect(rubberband(0, 300)).toBe(0);
    expect(rubberband(-50, 300)).toBe(-rubberband(50, 300));
  });
  it("gives less than the pull and never reaches the size of the thing", () => {
    expect(rubberband(100, 300)).toBeLessThan(100);
    expect(rubberband(1e9, 300)).toBeLessThan(300);
    expect(rubberband(200, 300)).toBeGreaterThan(rubberband(100, 300));
  });
});

describe("cn", () => {
  it("joins classes and drops falsy ones", () => {
    expect(cn("a", false, null, "b")).toBe("a b");
  });
});

describe("pad and sha256Hex", () => {
  it("pads to two digits", () => {
    expect([pad(7), pad(12), pad(0)]).toEqual(["07", "12", "00"]);
  });
  it("matches Node's hex SHA-256 on UTF-8 text", async () => {
    for (const s of ["", "abc", "Signé · 署名 ok"]) expect(await sha256Hex(s)).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
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

