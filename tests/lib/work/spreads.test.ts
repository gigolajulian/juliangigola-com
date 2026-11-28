import { describe, expect, it, test } from "vitest";
import { ALL_PROJECTS } from "@/lib/work/work";
import { SPREAD_SEED, spreadBlocks, spreadCode, spreadFor } from "@/lib/work/spreads";

const bySlug = new Map(ALL_PROJECTS.map((p) => [p.slug, p]));

test("every hand pick is for a real project", () => {
  for (const slug of Object.keys(SPREAD_SEED)) expect(bySlug.has(slug), slug).toBe(true);
});

test("every project's blocks cover its frames once, in order, after the hero", () => {
  for (const [slug, code] of Object.entries(SPREAD_SEED)) {
    const n = bySlug.get(slug)!.images.length;
    const blocks = spreadBlocks(code, n);
    expect(blocks, `${slug}: "${code}" does not fit ${n} frames`).not.toBeNull();
    expect(blocks!.flatMap((b) => b.frames)).toEqual(Array.from({ length: n - 1 }, (_, i) => i + 1));
  }
});

test("there is no single: a block is a pair, a row of three or a full", () => {
  for (const code of Object.values(SPREAD_SEED)) expect(code).toMatch(/^[fpr]+$/);
  expect(spreadBlocks("ps", 4)).toBeNull();
});

test("a code that no longer fits the frames falls back to today's layout", () => {
  expect(spreadBlocks("pf", 5)).toBeNull(); // a photo was added
  expect(spreadBlocks("pf", 3)).toBeNull(); // a photo was removed
  expect(spreadBlocks("", 4)).toBeNull();
  expect(spreadBlocks(undefined, 4)).toBeNull();
  expect(spreadFor("no-such-project", 4)).toBeNull();
});

test("an override that fits wins over the hand pick; one that does not is ignored", () => {
  const [slug, code] = Object.entries(SPREAD_SEED)[0];
  const n = bySlug.get(slug)!.images.length;
  const all = "f".repeat(n - 1);
  expect(spreadCode(spreadFor(slug, n, all)!)).toBe(all);
  expect(spreadCode(spreadFor(slug, n, "f")!)).toBe(n === 2 ? "f" : code);
});

test("blocks and codes round trip", () => {
  expect(spreadBlocks("pfr", 7)).toEqual([
    { kind: "pair", frames: [1, 2] },
    { kind: "full", frames: [3] },
    { kind: "row", frames: [4, 5, 6] },
  ]);
  expect(spreadCode(spreadBlocks("pfr", 7)!)).toBe("pfr");
});

describe("the admin's arrange control", () => {
  it("refit always covers frames 2 to count", async () => {
    const { refit, setBlock, spreadBlocks } = await import("@/lib/work/spreads");
    for (let count = 2; count <= 40; count++)
      for (const code of ["", "p", "frp", "rrrrrrrrrrrrrrr", "x"]) expect(spreadBlocks(refit(code, count), count), `${code} ${count}`).not.toBeNull();
    // a block changed: the ones before it stay, the rest are kept while they fit
    expect(setBlock("pfr", 0, "row", 7)).toBe("rfp");
    expect(setBlock("pfr", 2, "full", 7)).toBe("pffp");
    expect(setBlock("pp", 1, "row", 5)).toBe("pp");
  });

  it("the arranged code travels through the file the admin writes", async () => {
    const { projectsFile, adoptable } = await import("@/lib/admin/admin-payload");
    const base = { hidden: [], unlisted: [], categories: {}, frames: {}, credits: {}, copy: {}, order: [], covers: {}, spreads: {}, avatars: {}, slugs: {}, bts: {} };
    const file = projectsFile(null, { ...base, spreads: { paranoia: "rfp" } });
    expect(file.spreads).toEqual({ paranoia: "rfp" });
    expect(adoptable(JSON.parse(JSON.stringify(file)), base).spreads).toEqual({ paranoia: "rfp" });
    expect("spreads" in projectsFile(file, base)).toBe(false);
  });
});
