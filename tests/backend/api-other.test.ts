import { afterEach, describe, expect, it, vi } from "vitest";
import { githubToken, reply } from "./fakes";

/* The smaller routes: /api/traffic (behind the GitHub gate, the Cloudflare
   token never leaves the Worker), /api/tune (dev server only) and
   /picks.json (the inquiry form's picker). */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/traffic", async () => {
  const { GET } = await import("@/app/api/traffic/route");
  const get = (token?: string) =>
    GET(new Request("https://juliangigola.com/api/traffic", { headers: token ? { authorization: `Bearer ${token}` } : {} }));

  it("refuses without a token, or with one that cannot push", async () => {
    expect((await get()).status).toBe(401);
    vi.stubGlobal("fetch", vi.fn(async () => reply({ permissions: { push: false } })));
    expect((await get(githubToken())).status).toBe(401);
  });

  it("answers 503 when the Worker has no CF_ANALYTICS_TOKEN, and asks Cloudflare nothing", async () => {
    const fetch = vi.fn<(u: string) => Promise<Response>>(async () => reply({ permissions: { push: true } }));
    vi.stubGlobal("fetch", fetch);
    ctx.env = {};
    const res = await get(githubToken());
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(fetch.mock.calls.every(([u]) => String(u).startsWith("https://api.github.com/"))).toBe(true);
  });

  it("never puts the Cloudflare token in what it answers", async () => {
    const secret = "cf-analytics-secret-value";
    ctx.env = { CF_ANALYTICS_TOKEN: secret };
    vi.stubGlobal("fetch", vi.fn(async (u: string) =>
      String(u).startsWith("https://api.github.com/") ? reply({ permissions: { push: true } }) : reply("not json at all", 400)));
    const res = await get(githubToken());
    expect(await res.text()).not.toContain(secret);
  });
});

describe("POST /api/tune", async () => {
  const { POST } = await import("@/app/api/tune/route");
  it("is 404 outside the dev server, before it reads anything", async () => {
    const body = vi.fn();
    const res = await POST({ json: body } as unknown as Request);
    expect(process.env.NODE_ENV).not.toBe("development");
    expect(res.status).toBe(404);
    expect(body).not.toHaveBeenCalled();
  });
});

describe("GET /picks.json", async () => {
  const { GET } = await import("@/app/picks.json/route");
  const groups = (await GET().json()) as { name: string; frames: [string, number, number, string][] }[];

  it("answers groups in the picker's order, none empty", () => {
    const ORDER = ["Chroma", "Night", "White studio", "Grey studio", "Daylight", "Events", "Cover art", "More"];
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.map((g) => g.name)).toEqual(ORDER.filter((n) => groups.some((g) => g.name === n)));
    for (const g of groups) expect(g.frames.length).toBeGreaterThan(0);
  });

  it("offers each frame once, as a site path with its size and project", () => {
    const all = groups.flatMap((g) => g.frames);
    expect(new Set(all.map((f) => f[0])).size).toBe(all.length);
    for (const [src, w, h, name] of all) {
      expect(src).toMatch(/^\/[\w/.-]+\.(jpe?g|png|webp)$/i);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(name).toBeTruthy();
    }
  });

  /* The picker must offer only frames an enquiry keeps: the same pattern
     as the filter in `app/contact/actions.ts`. Found 2026-10-11 when the
     action kept only /work/ and dropped 30 /covers/ and /hero/ picks
     (fixed in #119). */
  it("offers only frames the contact form will keep", () => {
    const kept = /^\/(work\/[\w-]+|hero|covers)\/[\w.-]+\.(jpe?g|png|webp)$/i;
    const dropped = groups.flatMap((g) => g.frames.map((f) => f[0])).filter((src) => !kept.test(src));
    expect(dropped).toEqual([]);
  });
});
