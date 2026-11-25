import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { PROJECTS } from "@/lib/work/work";
import { BOOKING_PAGES, bookingHref } from "@/lib/booking/service-pages";

const SITE = "https://juliangigola.com";

describe("sitemap", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);

  it("lists each page once, all on the apex", () => {
    expect(new Set(urls).size).toBe(urls.length);
    for (const u of urls) expect(u.startsWith(SITE)).toBe(true);
  });

  it("leaves out /admin, /visit and the galleries that redirect to booking pages", () => {
    for (const u of urls) expect(u).not.toMatch(/\/(admin|visit)\b/);
    expect(urls).not.toContain(`${SITE}/portfolio/headshots`);
    expect(urls).not.toContain(`${SITE}/portfolio/graduation`);
  });

  it("lists every other project and every booking page above the projects", () => {
    for (const p of PROJECTS.filter((p) => !["headshots", "graduation"].includes(p.slug)))
      expect(urls).toContain(`${SITE}/portfolio/${p.slug}`);
    for (const b of BOOKING_PAGES) expect(entries.find((e) => e.url === `${SITE}${bookingHref(b)}`)?.priority).toBe(0.9);
    expect(entries.find((e) => e.url === SITE)?.priority).toBe(1);
  });

  it("gives each page's pictures as absolute, unique URLs, at most 1,000, and only real dates", () => {
    for (const e of entries) {
      const imgs = e.images ?? [];
      expect(imgs.length).toBeLessThanOrEqual(1000);
      expect(new Set(imgs).size).toBe(imgs.length);
      for (const i of imgs) expect(i.startsWith(`${SITE}/`)).toBe(true);
      if (e.lastModified) expect(Number.isFinite(new Date(e.lastModified).getTime())).toBe(true);
    }
  });
});
