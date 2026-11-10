import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTENT, CONTENT_PATH } from "@/lib/content";
import { COVER_RELEASES } from "@/lib/cover-art-data";

/* The parsed `content/site.json` (`lib/content.ts`) and the generated
   cover-art set it picks from (`lib/cover-art-data.ts`). */

describe("CONTENT", () => {
  it("reads from the path the editor writes", () => {
    expect(existsSync(CONTENT_PATH)).toBe(true);
  });

  it("has unique session slugs, each with something included", () => {
    const slugs = CONTENT.sessions.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of CONTENT.sessions) expect(s.includes.length).toBeGreaterThan(0);
  });

  it("has unique video ids", () => {
    const ids = CONTENT.videos.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("picks cover art only from releases that exist", () => {
    const known = new Set(COVER_RELEASES.map((r) => r.slug));
    expect(CONTENT.coverArt.filter((s) => !known.has(s))).toEqual([]);
  });
});

describe("COVER_RELEASES", () => {
  it("has unique slugs and one or two frames each, with a thumb", () => {
    const slugs = COVER_RELEASES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const r of COVER_RELEASES) {
      expect([1, 2]).toContain(r.frames.length);
      for (const f of r.frames) expect(f.thumb).toBeTruthy();
      if (r.frames.length === 2) expect(r.frames.every((f) => f.side)).toBe(true);
    }
  });
});
