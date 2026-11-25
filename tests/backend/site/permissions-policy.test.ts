import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/* Permissions-Policy per route, in both places that send it: `next.config.ts` (what the Worker renders) and
   `public/_headers` (the prerendered files Cloudflare serves without it). Public pages let Stripe's frame use the
   Payment Request API, so the deposit step can show Apple Pay and Google Pay; the private pages keep payment off. */

vi.mock("@opennextjs/cloudflare", () => ({ initOpenNextCloudflareForDev: () => {} }));

const STRIPE = 'payment=(self "https://js.stripe.com")';
const NONE = "payment=()";
const PUBLIC = ["/", "/book", "/book/portraits", "/headshots", "/weddings", "/contact", "/portfolio", "/legal", "/booking/abc"];
const PRIVATE = ["/admin", "/admin/leads", "/proof/04012026-ab2c3d4e", "/proof/04012026-ab2c3d4e/f/1", "/delivery/04012026-ab2c3d4e", "/visit", "/client/acme/"];

type Rule = { source: string; has?: { type: string; value: string }[]; headers: { key: string; value: string }[] };

/** Next's `source` patterns as this config writes them: a literal path, or a prefix ending in `/:path*`. */
const nextMatches = (source: string, path: string) =>
  source.endsWith("/:path*") ? path === source.slice(0, -7) || path.startsWith(`${source.slice(0, -7)}/`) || source === "/:path*" : path === source;

/** What the Worker sends for `path` on `host`: every matching rule in order, the last one winning per key. */
async function fromWorker(path: string, host = "juliangigola.com") {
  const rules = (await (await import("@/next.config")).default.headers!()) as Rule[];
  let value: string | undefined;
  for (const r of rules) {
    if (!nextMatches(r.source, path)) continue;
    if (r.has && !r.has.every((h) => h.type === "host" && h.value === host)) continue;
    for (const h of r.headers) if (h.key.toLowerCase() === "permissions-policy") value = h.value;
  }
  return value;
}

/** What Cloudflare's asset worker sends for `path`: matching blocks in file order, each unsetting (`! Name`) then setting. */
function fromEdge(path: string) {
  const text = readFileSync(join(process.cwd(), "public", "_headers"), "utf8");
  let value: string | undefined;
  let applies = false;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      const pat = line.trim();
      applies = pat.endsWith("*") ? path.startsWith(pat.slice(0, -1)) : path === pat;
      continue;
    }
    if (!applies) continue;
    const l = line.trim();
    if (/^!\s*permissions-policy$/i.test(l)) value = undefined;
    else if (/^permissions-policy:/i.test(l)) value = value ? `${value}, ${l.slice(19).trim()}` : l.slice(19).trim();
  }
  return value;
}

describe("Permissions-Policy", () => {
  for (const path of PUBLIC) {
    it(`lets Stripe's frame take a payment on ${path}`, async () => {
      for (const v of [await fromWorker(path), fromEdge(path)]) {
        expect(v).toContain(STRIPE);
        expect(v).toMatch(/camera=\(\), microphone=\(\), geolocation=\(\)/);
      }
    });
  }

  for (const path of PRIVATE) {
    it(`keeps payment off on ${path}`, async () => {
      for (const v of [await fromWorker(path), fromEdge(path)]) {
        expect(v).toContain(NONE);
        expect(v).not.toContain("stripe");
      }
    });
  }

  it("keeps payment off on the admin hosts", async () => {
    for (const host of ["admin.juliangigola.com", "leads.juliangigola.com"]) expect(await fromWorker("/", host)).toContain(NONE);
  });
});
