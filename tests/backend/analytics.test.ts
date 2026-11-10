import { afterEach, describe, expect, it, vi } from "vitest";
import { reply } from "./fakes";
import { ACCOUNT, cloudflare, engineSql, sitePath } from "@/lib/analytics";

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
});
