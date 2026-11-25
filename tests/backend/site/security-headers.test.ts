import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/* The security headers (BASELINE.md WEB-1), declared twice: `next.config.ts` for what the Worker renders and
   `public/_headers` for the prerendered files Cloudflare serves without it. Both copies must say the same, and say it. */

vi.mock("@opennextjs/cloudflare", () => ({ initOpenNextCloudflareForDev: () => {} }));

/** The `/*` block of public/_headers, as name to value. */
function staticHeaders() {
  const text = readFileSync(join(process.cwd(), "public", "_headers"), "utf8");
  const block = text.split(/\r?\n\/\*\r?\n/)[1].split(/\r?\n\s*\r?\n/)[0];
  return Object.fromEntries(block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => [l.slice(0, l.indexOf(":")).toLowerCase(), l.slice(l.indexOf(":") + 1).trim()]));
}

async function workerHeaders() {
  const config = (await import("@/next.config")).default;
  const all = await config.headers!();
  const site = all.find((h) => h.source === "/:path*")!;
  return Object.fromEntries(site.headers.map((h) => [h.key.toLowerCase(), h.value]));
}

const directives = (csp: string) => Object.fromEntries(csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));

describe("security headers", () => {
  it("are the same in next.config.ts and public/_headers", async () => {
    const [worker, edge] = [await workerHeaders(), staticHeaders()];
    for (const name of ["content-security-policy", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy", "cross-origin-opener-policy", "strict-transport-security"]) {
      expect(edge[name], `${name} in public/_headers`).toBeTruthy();
      expect(worker[name], `${name} in next.config.ts`).toBe(edge[name]);
    }
  });

  it("lock down framing, plugins, base and forms, and keep HTTPS for a year", () => {
    const h = staticHeaders();
    const csp = directives(h["content-security-policy"]);
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["frame-ancestors"]).toEqual(["'self'"]);
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    expect(csp["script-src"]).not.toContain("*");
    expect(csp["connect-src"]).not.toContain("*");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(Number(/max-age=(\d+)/.exec(h["strict-transport-security"])?.[1])).toBeGreaterThanOrEqual(31536000);
  });
});
