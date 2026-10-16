#!/usr/bin/env node
/* After a deploy: does every page load its own CSS and JS?
 *
 * 2026-10-16 the homepage reached visitors unstyled: a cached copy from the
 * previous build linked a stylesheet the deploy had removed (#186). This
 * reads the sitemap, fetches each page, and checks that every
 * /_next/static file the page links answers 200. It also flags a page
 * served from the edge cache (`CF-Cache-Status: HIT`), which should never
 * happen with Workers Caching off.
 *
 *   node scripts/live-check.mjs              # https://juliangigola.com
 *   node scripts/live-check.mjs <origin>     # another origin
 *
 * Wait about 90 seconds after a deploy goes live before running it.
 * Not named check-*.mjs on purpose: the commit gate runs those offline.
 * Exits 1 on any failure. About 150 requests: pages once, files once each.
 */

const origin = (process.argv[2] ?? "https://juliangigola.com").replace(/\/$/, "");
const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
// Gallery and photo pages share their chunks with the page above them, so
// the top-level pages cover every stylesheet. ponytail: all 119 if that changes.
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].replace(/^https:\/\/juliangigola\.com/, origin))
  .filter((u) => new URL(u).pathname.split("/").filter(Boolean).length <= 1);

const failures = [];
const assets = new Map(); // file -> first page that linked it

for (const page of pages) {
  const res = await fetch(page, { headers: { "cache-control": "no-cache" } });
  if (!res.ok) failures.push(`${res.status} page ${page}`);
  if (res.headers.get("cf-cache-status") === "HIT") failures.push(`HIT (edge cache) ${page}`);
  const html = await res.text();
  for (const [, file] of html.matchAll(/["'](\/_next\/static\/[^"'?#]+\.(?:css|js))/g))
    if (!assets.has(file)) assets.set(file, page);
}

for (const [file, page] of assets) {
  const res = await fetch(origin + file, { method: "HEAD" });
  if (res.status !== 200) failures.push(`${res.status} ${file} (linked from ${page})`);
}

console.log(`${pages.length} pages, ${assets.size} files`);
if (failures.length) {
  console.log(failures.join("\n"));
  process.exit(1);
}
console.log("ok: every page loads its CSS and JS, nothing from the edge cache");
