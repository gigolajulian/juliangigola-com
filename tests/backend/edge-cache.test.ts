import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* Workers Caching stays off (#186). On 2026-10-16 it kept the previous
   build's homepage for a year, linking a stylesheet the deploy had removed,
   and every visitor got the page unstyled. Julian: avoid that at all costs.
   This fails the gate if anyone turns it back on. */

describe("wrangler.jsonc", () => {
  it("keeps Workers Caching off", () => {
    const config = readFileSync("wrangler.jsonc", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(config).toMatch(/"cache"\s*:\s*\{\s*"enabled"\s*:\s*false\s*\}/);
  });
});
