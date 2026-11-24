import { afterEach, describe, expect, it, vi } from "vitest";
import { reply } from "../backend/fakes";
import { ACCOUNT, cloudflare, engineSql, rumVisits, searchConsole, sitePath } from "@/lib/analytics";

/* The admin's read-only doors to Cloudflare analytics (`lib/analytics.ts`). */

afterEach(() => vi.unstubAllGlobals());

describe("sitePath", () => {
  it("turns a Search Console URL into a site path", () => {
    expect(sitePath("https://juliangigola.com/portfolio")).toBe("/portfolio");
    expect(sitePath("https://www.juliangigola.com/")).toBe("/");
    expect(sitePath("https://juliangigola.com")).toBe("/");
    expect(sitePath("https://juliangigola.com.evil.test/x")).toBe("juliangigola.com.evil.test/x");
  });
});

describe("cloudflare", () => {
  it("sends the trimmed key and returns the viewer", async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push(init);
      return reply({ data: { viewer: { zones: [1] } } });
    });
    expect(await cloudflare(" key\n")("{ viewer }")).toEqual({ zones: [1] });
    expect((calls[0].headers as Record<string, string>).authorization).toBe("Bearer key");
  });

  it("throws Cloudflare's message, and the key's length but never the key", async () => {
    vi.stubGlobal("fetch", async () => reply({ errors: [{ message: "not authorized" }] }));
    await expect(cloudflare("k")("q")).rejects.toThrow("not authorized");
    vi.stubGlobal("fetch", async () => reply("", 400));
    const err = await cloudflare("secret-key")("q").catch((e: Error) => e.message);
    expect(err).toContain("key is 10 characters");
    expect(err).not.toContain("secret-key");
  });
});

describe("rumVisits", () => {
  it("asks for the account's visits in the window, without headless Chrome, and returns the groups", async () => {
    const queries: string[] = [];
    const groups = [{ sum: { visits: 3 }, dimensions: { date: "2026-11-09" } }];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      queries.push((JSON.parse(String(init.body)) as { query: string }).query);
      return reply({ data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: groups }] } } });
    });
    expect(await rumVisits("k", "date", "2026-11-01T00:00:00.000Z", "2026-11-08T00:00:00.000Z", 8)).toEqual(groups);
    expect(queries[0]).toBe(
      `{viewer{accounts(filter:{accountTag:"${ACCOUNT}"}){rumPageloadEventsAdaptiveGroups(limit:8,filter:{datetime_geq:"2026-11-01T00:00:00.000Z",datetime_lt:"2026-11-08T00:00:00.000Z",userAgentBrowser_neq:"ChromeHeadless"},orderBy:[sum_visits_DESC]){sum{visits} dimensions{date}}}}}`,
    );
  });
});

describe("engineSql", () => {
  it("posts to the account's SQL door and returns its rows", async () => {
    let url = "";
    vi.stubGlobal("fetch", async (u: string) => {
      url = u;
      return reply({ data: [{ n: 1 }] });
    });
    expect(await engineSql("k", "SELECT 1")).toEqual([{ n: 1 }]);
    expect(url).toContain(`/accounts/${ACCOUNT}/analytics_engine/sql`);
  });

  it("throws on a failed answer", async () => {
    vi.stubGlobal("fetch", async () => reply("bad sql", 422));
    await expect(engineSql("k", "x")).rejects.toThrow("Analytics Engine answered 422: bad sql");
  });

  it("throws its own message on a 200 that is not JSON", async () => {
    vi.stubGlobal("fetch", async () => reply("<html>", 200));
    await expect(engineSql("k", "x")).rejects.toThrow("Analytics Engine answered 200: <html>");
  });
});

describe("searchConsole", () => {
  it("refuses a malformed GSC_OAUTH without quoting it", async () => {
    const err = await searchConsole("{bad secret").catch((e: Error) => e.message);
    expect(err).toBe("GSC_OAUTH is not valid JSON");
    expect(err).not.toContain("bad secret");
  });
});
