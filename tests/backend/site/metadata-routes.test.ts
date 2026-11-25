import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as canvas } from "@/app/canvas.json/route";
import { GET as visit } from "@/app/visit/route";
import { GET as leadsWorker } from "@/app/admin/leads/sw.js/route";
import { PROJECTS } from "@/lib/work/work";

/* The static routes: the canvas frames, the unlisted /visit page and the
   Leads app's service worker. robots, manifest and sitemap have their own files. */

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
