/**
 * Collects collaborators' profile photographs into `public/people`.
 *
 *   node --no-warnings scripts/faces.mjs            every credited handle
 *   node --no-warnings scripts/faces.mjs anisajadee one of them
 *   node --no-warnings scripts/faces.mjs --force    fetch them all again
 *
 * Why a script you run and not a button in /admin: Instagram answers a
 * request from a home connection and refuses one from a datacentre.
 * Measured from a Worker on Cloudflare's edge (SJC), every user agent came
 * back 429, and the two public text proxies came back 429 and 403; the
 * same request from this machine is a 200 with the picture in `og:image`.
 * So the fetch lives where it works, which is here.
 *
 * What it does, per handle: asks Instagram for the profile the way a chat
 * app does when a profile is pasted into it, reads `og:image`, downloads
 * the picture, and writes it to `public/people/<handle>.jpg` with an entry
 * in `content/projects.json` so the site can find it. An existing picture
 * is left alone unless `--force` says otherwise, so this is safe to run
 * whenever credits have been added.
 *
 * Nothing here runs on the live site or in a build. The site only ever
 * serves the copy: Instagram's own picture addresses are signed and expire
 * within days.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const MANIFEST = "content/projects.json";
const FOLDER = "public/people";
/** What a link preview sends. A browser's own agent gets an empty shell. */
const CRAWLER = "facebookexternalhit/1.1";
/* The crawler that is answered with the bigger copy. `og:image` is 100px
   square, which is soft at 56px on a retina screen; the page a search
   crawler is served carries a 150px one beside it. Asked for first, with
   the link preview as the fallback. */
const INDEXER =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const args = process.argv.slice(2);
const force = args.includes("--force");
const asked = args.filter((a) => !a.startsWith("--")).map((a) => a.toLowerCase());

/**
 * Every handle the site credits, once each.
 *
 * Read off the two files rather than through `lib/work.ts`, which imports
 * by bundler resolution and cannot be loaded by Node as it stands. The
 * handles live in `content/projects.json`, where /admin writes them, and
 * six of the harvested credits carry the handle as the name — those are
 * read straight off the generated manifest.
 */
const IG = /^[a-z0-9_][a-z0-9._]{0,29}$/;
const collected = new Set();
for (const list of Object.values(
  JSON.parse(readFileSync(MANIFEST, "utf8")).credits ?? {},
)) {
  for (const c of list) {
    const h = (c.instagram || (c.name ?? "").replace(/^@/, "")).toLowerCase();
    if (c.instagram ? IG.test(h) : (c.name ?? "").startsWith("@") && IG.test(h))
      collected.add(h);
  }
}
for (const [, name] of readFileSync("lib/work-data.ts", "utf8").matchAll(
  /"name": "@([A-Za-z0-9._]{1,30})"/g,
)) {
  if (IG.test(name.toLowerCase())) collected.add(name.toLowerCase());
}

const handles = [...collected].filter((h) =>
  asked.length ? asked.includes(h) : true,
);

if (!handles.length) {
  console.log("No handles on any credit yet. Add them in /admin.");
  process.exit(0);
}

const file = JSON.parse(readFileSync(MANIFEST, "utf8"));
const avatars = { ...(file.avatars ?? {}) };
mkdirSync(FOLDER, { recursive: true });

let got = 0;
let kept = 0;
const missed = [];

for (const handle of handles) {
  const path = `${FOLDER}/${handle}.jpg`;
  if (!force && existsSync(path)) {
    avatars[handle] = `/people/${handle}.jpg`;
    kept++;
    continue;
  }
  try {
    const page = await fetch(`https://www.instagram.com/${handle}/`, {
      headers: { "user-agent": INDEXER, accept: "text/html" },
      signal: AbortSignal.timeout(20000),
    });
    if (!page.ok) throw new Error(`profile ${page.status}`);
    const html = await page.text();
    const found =
      /<img[^>]+src="([^"]*s150x150[^"]+)"/.exec(html)?.[1] ??
      /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
    if (!found) throw new Error("no picture on the page");

    const src = found.replaceAll("&amp;", "&");
    // Instagram's own CDN or nothing: this writes a file into the repo.
    const host = new URL(src).hostname;
    if (!/(^|\.)cdninstagram\.com$|(^|\.)fbcdn\.net$/.test(host))
      throw new Error(`picture at ${host}`);

    const shot = await fetch(src, {
      headers: { "user-agent": CRAWLER },
      signal: AbortSignal.timeout(20000),
    });
    const type = shot.headers.get("content-type") ?? "";
    if (!shot.ok || !type.startsWith("image/"))
      throw new Error(`picture ${shot.status} ${type}`);
    const bytes = Buffer.from(await shot.arrayBuffer());
    if (!bytes.length || bytes.length > 400_000)
      throw new Error(`${bytes.length} bytes`);

    writeFileSync(path, bytes);
    avatars[handle] = `/people/${handle}.jpg`;
    got++;
    console.log(`  ${handle}  ${(bytes.length / 1024).toFixed(1)}kB`);
  } catch (e) {
    // A private account, a deleted one, a rate limit: all the same to us.
    // The picture can be dropped in by hand in /admin instead.
    missed.push(`${handle} (${e instanceof Error ? e.message : e})`);
  }
}

// Sorted, so the committed file does not churn on iteration order.
file.avatars = Object.fromEntries(
  Object.entries(avatars).sort(([a], [b]) => (a < b ? -1 : 1)),
);
if (!Object.keys(file.avatars).length) delete file.avatars;
writeFileSync(MANIFEST, `${JSON.stringify(file, null, 2)}\n`);

console.log(
  `faces: ${got} fetched, ${kept} already had one, ${missed.length} missed`,
);
for (const m of missed) console.log(`  missed ${m}`);
