import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/seo/route";
import { SCOPED, githubToken, reply } from "./fakes";

/* /api/seo: behind a GitHub token that can push, off without
   CF_ANALYTICS_TOKEN, refuses a map path that is not a page, and answers
   the tab from Cloudflare's numbers with Google not connected. */

const ctx = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: async () => ({ env: ctx.env }) }));

const get = (q = "", token?: string) => GET(new Request(`https://juliangigola.com/api/seo${q}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }));
const today = new Date().toISOString().slice(0, 10);

beforeEach(() => {
  ctx.env = { CF_ANALYTICS_TOKEN: "cf-analytics-secret-value" };
  vi.stubGlobal("fetch", async (url: string) => {
    if (url.startsWith("https://api.github.com/")) return reply({ permissions: { push: true } }, 200, SCOPED);
    if (url.endsWith("/graphql"))
      return reply({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: [{ sum: { visits: 3 }, dimensions: { requestPath: "/portfolio", date: today, refererHost: "" } }] }] } } });
    if (url.includes("/analytics_engine/sql")) return reply({ data: [{ path: "/portfolio", views: 3 }] });
    return reply({}, 404);
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("GET /api/seo", () => {
  it("refuses no token and one that cannot push", async () => {
    expect((await get()).status).toBe(401);
    vi.stubGlobal("fetch", async () => reply({ permissions: { push: false } }));
    expect((await get("", githubToken())).status).toBe(401);
  });

  it("is off without CF_ANALYTICS_TOKEN, and refuses a map path that is not a page", async () => {
    expect((await get("?map=/x' OR 1=1", githubToken())).status).toBe(400);
    ctx.env = {};
    expect((await get("", githubToken())).status).toBe(503);
  });

  it("answers pages, sources and beacon views, never the token", async () => {
    const res = await get("?days=7", githubToken());
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("cf-analytics-secret-value");
    const o = JSON.parse(text);
    expect(o).toMatchObject({ days: 7, visits: 3, google: { error: expect.any(String) }, tracked: [{ path: "/portfolio", views: 3 }] });
    expect(o.pages[0]).toMatchObject({ path: "/portfolio", visits: 3 });
    expect(o.dates).toHaveLength(7);
  });
});
