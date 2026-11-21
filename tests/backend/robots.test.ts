import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

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
