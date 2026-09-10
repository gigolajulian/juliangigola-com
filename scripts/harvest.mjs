/**
 * One-off migration: pulls the work off the old Format site into this repo.
 *
 * Format serves every page as JSON at `<path>?format=json`, which carries far
 * more than the rendered HTML does — full-resolution image URLs, per-asset
 * dominant colours (free blur placeholders), alt text, and the credits block.
 * So this reads the API rather than scraping markup.
 *
 * Two page types matter:
 *   `listing` — a category (EDITORIAL, WEDDINGS, …). Its assets are
 *               `linked_image`s pointing at the projects inside it, so the
 *               listings *are* the taxonomy.
 *   `gallery` — a project. Its assets are the photographs.
 *
 * Writes `public/work/<slug>/NN.jpg` and seeds `lib/work-data.ts`.
 *
 * Run once:  node scripts/harvest.mjs
 * Re-runs are cheap — page JSON is cached under .harvest-cache/ and images
 * already on disk are skipped. `--refresh` clears the cache.
 */
import { mkdir, writeFile, readFile, stat, rename, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import sharp from "sharp";

const SITE = "https://www.juliangigola.com";
const CACHE = ".harvest-cache";
const OUT_IMAGES = "public/work";
const OUT_MANIFEST = "lib/work-data.ts";
const REFRESH = process.argv.includes("--refresh");

/**
 * Format's largest render is 2500px, which averages 2.5 MB — about 2.7 GB
 * across the whole archive, and far more pixels than the site can ever show.
 * 1600px is the widest a frame gets on a 2x laptop, and `next/image` derives
 * every smaller size from it, so nothing downstream loses resolution.
 */
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 82;

/**
 * Every project also gets a small copy of its opening frame, at
 * `public/work/<slug>/cover.jpg`.
 *
 * Two places need a lot of frames at once and none of them large: the
 * homepage corridor (18 cards in flight, the widest about 480px on a large
 * screen) and the work index's hover preview. Pointing those at the 1600px
 * originals costs ~5 MB before anything is even visible.
 */
const COVER_WIDTH = 600;

/** Pages that are site furniture, not work. */
const SKIP = new Set(["/", "/about", "/contact", "/rates", "/links", "/store", "/sessions"]);

/* ── plumbing ─────────────────────────────────────────────────── */

/** Runs `fn` over `items`, `limit` at a time. Format rate-limits a flood. */
async function pool(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const n = i++;
        out[n] = await fn(items[n], n);
      }
    }),
  );
  return out;
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Page JSON, memoised on disk — the crawl is ~100 requests and we re-run it. */
async function pageJson(urlPath) {
  const file = path.join(CACHE, urlPath.replace(/[^a-z0-9]+/gi, "_") + ".json");
  if (!REFRESH && (await exists(file))) return JSON.parse(await readFile(file, "utf8"));

  const res = await fetch(SITE + urlPath + "?format=json");
  if (!res.ok) throw new Error(`${urlPath} → ${res.status}`);
  const json = await res.json();
  await writeFile(file, JSON.stringify(json));
  return json;
}

/* ── parsing ──────────────────────────────────────────────────── */

const ENTITIES = { amp: "&", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

const stripTags = (html) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? " ")
    .trim();

/**
 * A project's title block is freeform rich text. In practice Julian writes it
 * as a heading plus `Label: Name` lines, so pull the credits out as pairs and
 * keep whatever prose is left as the intent copy.
 */
function parseTitle(title) {
  if (!title || !title.copy) return { headline: null, credits: [], intent: null };

  const blocks = title.copy
    .split(/<\/(?:h[1-6]|p|div)>/i)
    .map((b) => stripTags(b))
    .filter(Boolean);

  const heading = title.copy.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  const headline = heading ? stripTags(heading[1]) : null;

  const credits = [];
  const prose = [];
  for (const block of blocks) {
    if (block === headline) continue;
    // `Photographer: Julian Gigola` — a short label before a colon. The length
    // cap keeps a sentence that happens to contain a colon out of the credits.
    const m = block.match(/^([A-Za-z][\w /&.-]{1,28}):[ \t]*(.+)$/);
    if (m) credits.push({ role: m[1].trim(), name: m[2].trim() });
    else prose.push(block);
  }

  return { headline, credits, intent: prose.join("\n\n") || null };
}

const slugOf = (urlPath) => urlPath.replace(/^\//, "").replace(/\/$/, "");

/** Best available render of an asset. */
function bestImage(asset) {
  for (const key of ["2500x0", "1600x0", "1200x0", "900x0"]) {
    const url = asset["image_url_" + key];
    if (url) return url;
  }
  return null;
}

/**
 * Brings a downloaded frame down to `MAX_WIDTH` and reports its real
 * dimensions. Idempotent: a frame already at or under the cap is only measured,
 * so re-running the harvester is cheap and never re-compresses (which would
 * cost a generation of quality each time).
 *
 * Dimensions are read off the file rather than taken from Format's metadata —
 * after a resize, Format's numbers are no longer true, and the manifest feeds
 * `next/image`, which will letterbox on a wrong aspect ratio.
 */
async function ensureOptimized(file) {
  const meta = await sharp(file).metadata();
  if (meta.width <= MAX_WIDTH) return { width: meta.width, height: meta.height };

  // sharp cannot write to the file it is reading, so bounce through a sibling.
  const tmp = file + ".tmp";
  const { width, height } = await sharp(file)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(tmp);
  await rename(tmp, file);
  return { width, height };
}

/* ── crawl ────────────────────────────────────────────────────── */

await mkdir(CACHE, { recursive: true });

const sitemap = await (await fetch(SITE + "/sitemap.xml")).text();
const paths = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)]
  .map((m) => new URL(m[1]).pathname)
  .map((p) => (p === "" ? "/" : p))
  // Format leaves duplicate routes behind, e.g. `/14181178-editorial`.
  .filter((p) => !/^\/\d+-/.test(p))
  .filter((p) => !SKIP.has(p));

console.log(`sitemap: ${paths.length} candidate pages`);

const pages = new Map();
await pool(paths, 6, async (p) => {
  try {
    pages.set(p, (await pageJson(p)).page);
  } catch (err) {
    console.warn(`  skip ${p}: ${err.message}`);
  }
});

const listings = [...pages].filter(([, pg]) => pg.type === "listing");
const galleries = [...pages].filter(([, pg]) => pg.type === "gallery");
console.log(`  ${listings.length} listings, ${galleries.length} galleries`);

/**
 * The nav is the authoritative taxonomy — the listing pages alone are not.
 * Half the old site's nav leaves are `listing`s holding many projects
 * (EDITORIAL), and half are `gallery`s that *are* a single project
 * (WEDDINGS). `menu_items` is the only place that records which section each
 * leaf belongs to, so read it rather than inferring.
 */
const menu = (await pageJson("/about")).menu_items ?? [];
const sections = menu
  .filter((g) => g.type === "category")
  .map((g) => ({
    name: g.name,
    categories: (g.pages ?? []).map((p) => ({ slug: slugOf(p.href), name: p.name })),
  }));

/** category slug → the section that holds it. */
const sectionOf = new Map();
for (const s of sections) for (const c of s.categories) sectionOf.set(c.slug, s.name);

/** project slug → the categories it appears under, old-site order. */
const categoryOf = new Map();
const addCategory = (projectSlug, category) => {
  if (!categoryOf.has(projectSlug)) categoryOf.set(projectSlug, []);
  categoryOf.get(projectSlug).push(category);
};

for (const [p, pg] of listings) {
  const category = { slug: slugOf(p), name: pg.name, section: sectionOf.get(slugOf(p)) ?? null };
  for (const a of pg.assets ?? []) {
    if (a.link_url) addCategory(slugOf(a.link_url), category);
  }
}

// A nav leaf that is itself a gallery is its own category — otherwise
// /weddings and /headshots fall out of the taxonomy entirely.
for (const [slug, name] of sectionOf) {
  const pg = pages.get("/" + slug);
  if (pg?.type === "gallery") {
    addCategory(slug, {
      slug,
      name: sections.flatMap((s) => s.categories).find((c) => c.slug === slug)?.name ?? pg.name,
      section: name,
    });
  }
}

/* ── download ─────────────────────────────────────────────────── */

let fetched = 0;
let skipped = 0;

const projects = await pool(galleries, 4, async ([urlPath, pg]) => {
  const slug = slugOf(urlPath);
  const assets = (pg.assets ?? []).filter((a) => a.type === "image");
  if (!assets.length) return null;

  const dir = path.join(OUT_IMAGES, slug);
  await mkdir(dir, { recursive: true });

  const files = await pool(assets, 3, async (asset, i) => {
    const url = bestImage(asset);
    if (!url) return null;

    const name = String(i + 1).padStart(2, "0") + ".jpg";
    const dest = path.join(dir, name);

    if (await exists(dest)) {
      skipped++;
    } else {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  ${slug}/${name} → ${res.status}`);
        return null;
      }
      // Download to a sibling first, so an interrupted run cannot leave a
      // truncated file behind that the next run would then "skip".
      const partial = dest + ".part";
      await pipeline(res.body, createWriteStream(partial));
      await rename(partial, dest);
      fetched++;
    }

    let dims;
    try {
      dims = await ensureOptimized(dest);
    } catch (err) {
      console.warn(`  ${slug}/${name} unreadable (${err.message}) — dropping`);
      await unlink(dest).catch(() => {});
      return null;
    }

    return {
      src: `/work/${slug}/${name}`,
      width: dims.width,
      height: dims.height,
      color: asset.dominant_color ?? "#1a1a1a",
      alt: asset.alt_text || "",
    };
  });

  const images = files.filter(Boolean);
  if (!images.length) return null;

  // Small copy of the opener, for the corridor and the index previews.
  const coverPath = path.join(dir, "cover.jpg");
  let cover = null;
  if (!(await exists(coverPath))) {
    const { width, height } = await sharp(path.join(process.cwd(), images[0].src.replace(/^\//, "public/")))
      .resize({ width: COVER_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toFile(coverPath);
    cover = { width, height };
  } else {
    const meta = await sharp(coverPath).metadata();
    cover = { width: meta.width, height: meta.height };
  }

  const { headline, credits, intent } = parseTitle(pg.title);
  return {
    slug,
    name: pg.name,
    headline,
    intent,
    credits,
    categories: categoryOf.get(slug) ?? [],
    cover: {
      src: `/work/${slug}/cover.jpg`,
      width: cover.width,
      height: cover.height,
      color: images[0].color,
      alt: images[0].alt,
    },
    images,
  };
});

const kept = projects.filter((p) => p && p.images.length).sort((a, b) => a.name.localeCompare(b.name));
console.log(`images: ${fetched} downloaded, ${skipped} already on disk`);

/* ── manifest ─────────────────────────────────────────────────── */

// Every category the nav knows about, in nav order — which is Julian's own
// ordering, and better than anything alphabetical would give us.
const categories = sections.flatMap((s) =>
  s.categories.map((c) => ({ ...c, section: s.name })),
);

const banner = `// GENERATED by scripts/harvest.mjs from the old Format site, then edited by hand.
// Safe to edit: titles, intent copy, credits, ordering, \`alt\` text, and which
// projects are featured. Re-running the harvester overwrites this file — copy
// anything you have hand-written somewhere safe first.
`;

await writeFile(
  OUT_MANIFEST,
  banner +
    '\nimport type { Project, Category } from "./work-types";\n\n' +
    "export const CATEGORIES: Category[] = " +
    JSON.stringify(categories, null, 2) +
    ";\n\nexport const PROJECTS: Project[] = " +
    JSON.stringify(kept, null, 2) +
    ";\n",
);

console.log(`wrote ${OUT_MANIFEST}: ${kept.length} projects, ${categories.length} categories`);
const missingAlt = kept.reduce((n, p) => n + p.images.filter((i) => !i.alt).length, 0);
if (missingAlt) console.log(`note: ${missingAlt} images have no alt text — worth a pass by hand`);
