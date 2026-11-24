import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPLASH_RUN } from "@/lib/work/splash-run";
import { CALL_CARD, DOORS, HERO } from "@/lib/photos";
import { INDEX_ORDER, isSession, LENGTH, priceLabel, SESSIONS, TAB_ORDER, type Session } from "@/lib/booking/catalog";
import { CATEGORIES, PROJECTS } from "@/lib/work/work-data";
import { PROJECTS as SITE_PROJECTS } from "@/lib/work/work";
import { byCodeUnit } from "@/lib/utils";

/* The archive and the lists built from it: invariants that, broken, show
   up on the site as a dead link, a missing photo or a wrong count. */

const onDisk = (src: string) => existsSync(join(process.cwd(), "public", src));

describe("work-data", () => {
  it("has unique category and project slugs", () => {
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
    expect(new Set(PROJECTS.map((p) => p.slug)).size).toBe(PROJECTS.length);
  });
  it("files every project under known categories, with a cover and sized frames", () => {
    const known = new Set(CATEGORIES.map((c) => c.slug));
    for (const p of PROJECTS) {
      for (const c of p.categories) expect(known.has(c.slug), `${p.slug} in ${c.slug}`).toBe(true);
      expect(p.cover.src, p.slug).toMatch(/^\//);
      for (const f of p.images) expect(f.width > 0 && f.height > 0, f.src).toBe(true);
    }
  });
});

describe("splash-run", () => {
  it("is up to eight distinct covers, without the hero it ends on", () => {
    expect(SPLASH_RUN.length).toBeGreaterThan(0);
    expect(SPLASH_RUN.length).toBeLessThanOrEqual(8);
    expect(new Set(SPLASH_RUN).size).toBe(SPLASH_RUN.length);
    expect(SPLASH_RUN).not.toContain(HERO[0].d.src);
    expect(SPLASH_RUN).not.toContain(HERO[0].l.src);
    for (const s of SPLASH_RUN) expect(onDisk(s), s).toBe(true);
  });
});

describe("v3", () => {
  it("points every hero, door and call card at a photo on disk", () => {
    const srcs = [...HERO.flatMap((p) => [p.d.src, p.l.src]), ...Object.values(DOORS).flatMap((p) => [p.d, p.l]), CALL_CARD.d, CALL_CARD.l];
    for (const s of srcs) expect(onDisk(s), s).toBe(true);
  });
  it("keys each session by its own slug, with a length, and orders known ones", () => {
    for (const [k, s] of Object.entries(SESSIONS)) expect(s.slug).toBe(k);
    expect(Object.keys(LENGTH).sort(byCodeUnit)).toEqual(Object.keys(SESSIONS).sort(byCodeUnit));
    for (const s of [...TAB_ORDER, ...INDEX_ORDER]) expect(isSession(s), s).toBe(true);
    expect(isSession("toString")).toBe(false);
    expect(isSession(undefined)).toBe(false);
  });
  it("says the rate as the card shows it", () => {
    const s = (o: Partial<Session>) =>
      ({ slug: "portraits", name: "", includes: [], photo: { d: "", l: "" }, from: null, paid: false, ...o }) as Session;
    expect(priceLabel(s({ cal: "x/y" }))).toBe("15 min");
    expect(priceLabel(s({ paid: true, from: 400 }))).toBe("From $400");
    expect(priceLabel(s({ paid: true }))).toBe("$100 deposit");
    expect(priceLabel(s({}))).toBe("On request");
  });
});

describe("credits", () => {
  it("puts Julian's own photo credit last on every page", () => {
    const photo = /^photo(grapher|graphy)?$/i;
    const live = SITE_PROJECTS.filter((p) => p.credits.some((c) => photo.test(c.role.trim())));
    expect(live.length).toBeGreaterThan(10);
    for (const p of live) {
      const last = p.credits.findIndex((c) => photo.test(c.role.trim()));
      expect(
        p.credits.slice(last).every((c) => photo.test(c.role.trim())),
        p.slug,
      ).toBe(true);
    }
  });
});
