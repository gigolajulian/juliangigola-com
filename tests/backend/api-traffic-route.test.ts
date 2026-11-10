import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/traffic/route";
import { SCOPED, githubToken, reply } from "./fakes";

/* /api/traffic: behind a GitHub token that can push, off without
   CF_ANALYTICS_TOKEN, and the Traffic tab from Cloudflare's numbers with
   bots counted apart and Google and Bing not connected. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const get = (token?: string) => GET(new Request("https://juliangigola.com/api/traffic", { headers: token ? { authorization: `Bearer ${token}` } : {} }));

beforeEach(() => {
  ctx.env = { CF_ANALYTICS_TOKEN: "cf-analytics-secret-value" };
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.startsWith("https://api.github.com/")) return reply({ permissions: { push: true } }, 200, SCOPED);
    if (url.endsWith("/graphql"))
      return reply({
        data: {
          viewer: {
            accounts: [{ rumPageloadEventsAdaptiveGroups: [{ sum: { visits: 4 }, dimensions: { x: "2026-11-09" } }] }],
            zones: [{ httpRequestsAdaptiveGroups: [{ count: 9, dimensions: { userAgent: "Googlebot/2.1" } }, { count: 5, dimensions: { userAgent: "Mozilla/5.0 Safari" } }] }],
          },
        },
      });
    return reply({}, 404);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("GET /api/traffic", () => {
  it("refuses no token and one that cannot push", async () => {
    expect((await get()).status).toBe(401);
    vi.stubGlobal("fetch", async () => reply({ permissions: { push: false } }));
    expect((await get(githubToken())).status).toBe(401);
  });

  it("is off without CF_ANALYTICS_TOKEN", async () => {
    ctx.env = {};
    expect((await get(githubToken())).status).toBe(503);
  });

  it("answers visits and bots, never the token", async () => {
    const res = await get(githubToken());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("cf-analytics-secret-value");
    const o = JSON.parse(text);
    expect(o).toMatchObject({ visits: 4, bots: 9, google: { error: expect.any(String) }, bing: { error: expect.any(String) } });
    expect(o.topBots[0]).toEqual({ n: 9, key: "Googlebot/2.1" });
  });
});
