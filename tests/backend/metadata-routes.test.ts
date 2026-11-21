import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import manifest from "@/app/manifest";
import sitemap from "@/app/sitemap";
import { GET as canvas } from "@/app/canvas.json/route";
import { GET as visit } from "@/app/visit/route";
import { GET as leadsWorker } from "@/app/admin/leads/sw.js/route";
import { PROJECTS } from "@/lib/work/work";
import { BOOKING_PAGES, bookingHref } from "@/lib/booking/booking";

/* The static routes: robots.txt, the manifest, the sitemap, the canvas
   frames, the unlisted /visit page and the Leads app's service worker. */

const SITE = "https://juliangigola.com";

describe("robots", () => {
  const { rules, sitemap: map } = robots();
  const list = Array.isArray(rules) ? rules : [rules];
  const blocked = list.find((r) => Array.isArray(r.userAgent))!;

  it("keeps /admin out of the index and points at the sitemap", () => {
    expect(list[0]).toMatchObject({ userAgent: "*", allow: "/", disallow: "/admin" });
    expect(map).toBe(`${SITE}/sitemap.xml`);
  });

  it("bars the training crawlers from everything and leaves search and AI search in", () => {
    expect(blocked.disallow).toBe("/");
    for (const bot of ["GPTBot", "ClaudeBot", "CCBot", "Applebot-Extended"]) expect(blocked.userAgent).toContain(bot);
    for (const bot of ["Googlebot", "Bingbot", "Googlebot-Image", "Google-Extended", "OAI-SearchBot", "PerplexityBot", "Claude-SearchBot"])
      expect(blocked.userAgent).not.toContain(bot);
  });
});

describe("manifest", () => {
  it("installs on the dark ground with an any and a maskable icon", () => {
    const m = manifest();
    expect(m).toMatchObject({ start_url: "/", display: "standalone", background_color: "#0b0a09", theme_color: "#0b0a09" });
    expect(m.icons?.map((i) => i.purpose)).toEqual(["any", "any", "maskable"]);
  });
});

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
    for (const p of PROJECTS.filter((p) => !["headshots", "graduation"].includes(p.slug))) expect(urls).toContain(`${SITE}/portfolio/${p.slug}`);
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

describe("canvas.json", () => {
  it("gives each project's frames in order as [src, ratio, alt, colour]", async () => {
    const out = (await canvas().json()) as Record<string, [string, number, string, string][]>;
    const p = PROJECTS[0];
    expect(Object.keys(out)).toEqual(PROJECTS.map((x) => x.slug));
    expect(out[p.slug].map((f) => f[0])).toEqual(p.images.map((f) => f.src));
    const [, ratio, alt] = out[p.slug][0];
    expect(ratio).toBeCloseTo(p.images[0].height / p.images[0].width, 3);
    expect(alt).toBe((p.images[0].alt ?? p.name).trim());
  });
});

describe("/visit", () => {
  it("is a noindex HTML page whose scripts are all from this origin", async () => {
    const res = visit();
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await res.text();
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThan(0);
    for (const s of srcs) expect(s.startsWith("/visit/")).toBe(true);
  });
});

describe("the Leads service worker", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("claims the root scope, is never cached and parses as a script", async () => {
    const res = leadsWorker();
    expect(res.headers.get("service-worker-allowed")).toBe("/");
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(res.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    const src = await res.text();
    expect(() => new Function(src)).not.toThrow();
  });

  it("keeps the offline shell out of next dev, and never caches the API", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await leadsWorker().text()).not.toContain('addEventListener("fetch"');
    vi.stubEnv("NODE_ENV", "production");
    const src = await leadsWorker().text();
    expect(src).toContain('addEventListener("fetch"');
    expect(src).not.toContain("/api/");
  });
});
