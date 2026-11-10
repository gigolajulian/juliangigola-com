import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPUS_GUIDES, campusGuide, campusHref } from "@/lib/campus-guides";

/* The graduation campus guides (`lib/campus-guides.ts`). */

describe("campus guides", () => {
  it("has unique slugs, found and linked under /graduation-photos", () => {
    const slugs = CAMPUS_GUIDES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const c of CAMPUS_GUIDES) {
      expect(campusGuide(c.slug)).toBe(c);
      expect(campusHref(c)).toBe(`/graduation-photos/${c.slug}`);
    }
    expect(campusGuide("nope")).toBeUndefined();
  });

  it("builds the photo row from the spots' own frames", () => {
    for (const c of CAMPUS_GUIDES) {
      const frames = new Set(c.spots.flatMap((s) => s.frames));
      for (const p of c.photos) expect(frames.has(p)).toBe(true);
    }
  });

  it("points every frame at a served photograph", () => {
    const all = CAMPUS_GUIDES.flatMap((c) => [...c.photos, ...c.spots.flatMap((s) => s.frames)]);
    expect(all.filter((p) => !existsSync(join("public", p)))).toEqual([]);
  });
});
