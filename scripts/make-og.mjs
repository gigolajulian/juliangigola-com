/**
 * The share card, cropped from whatever photograph is currently the cover.
 *
 * Runs as `prebuild`, so it happens on every deploy — which means changing
 * the cover in /admin changes the thumbnail Slack, iMessage, WhatsApp,
 * LinkedIn and X draw, with nothing else to do and nobody to remember.
 *
 * Why a build step rather than a URL:
 *
 *   - Cloudflare Image Transformations would crop this on the fly with no
 *     script at all, but they are not enabled on the zone: every
 *     `/cdn-cgi/image/...` URL 404s today, which is also why
 *     `NEXT_PUBLIC_IMAGE_CDN` is off. See `image-loader.ts`.
 *   - Pointing the card straight at the cover frame needs no machinery
 *     either, and then every unfurler crops a 1.91:1 slice out of the middle
 *     of a portrait photograph. For a photographer that is worse than no card.
 *   - `next/og` would compose one at build time, but it drags Satori and a
 *     resvg WASM blob into a Worker bundle with 3MB to spend.
 *
 * **This script cannot fail a build.** Everything is wrapped: a missing
 * `sharp`, an unreadable manifest, a frame that is not on disk — each logs a
 * warning and exits 0, leaving the committed `public/og.jpg` in place. The
 * card is then one cover out of date, which is a small wrong; a photographer's
 * site failing to deploy because a thumbnail could not be cropped is a large
 * one.
 *
 *   node scripts/make-og.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 1200x630 is what every unfurler crops to, so it is what gets made. */
const CARD = { width: 1200, height: 630 };

/**
 * A card over 300KB is one some services will not fetch. X allows 5MB and
 * Slack is generous, but WhatsApp has historically dropped anything past
 * 300KB and shows no image at all rather than a smaller one.
 */
const MAX_KB = 300;

function warn(why) {
  console.warn(`make-og: ${why} — keeping the committed public/og.jpg`);
  process.exit(0);
}

/**
 * The projects out of `lib/work-data.ts`.
 *
 * Sliced and parsed rather than imported. The module is TypeScript, and the
 * two ways to import it both cost more than they are worth here: a bundler,
 * or Node's type stripping, which needs a flag that older Node versions do
 * not have — and this runs on Cloudflare's builder, whose Node version is not
 * ours to choose. The array is pure JSON literals, so the slice is exact.
 */
function manifest() {
  const src = readFileSync(join(root, "lib/work-data.ts"), "utf8");
  const from = src.indexOf("export const PROJECTS");
  if (from === -1) return null;

  /* After the `=`, not after the declaration: the type annotation is
     `Project[]`, so the first `[` in `export const PROJECTS: Project[] = [`
     belongs to the type and the slice started `[] = [`. */
  const assign = src.indexOf("=", from);
  const open = src.indexOf("[", assign);
  const close = src.lastIndexOf("]");
  if (open === -1 || close <= open) return null;
  try {
    return JSON.parse(src.slice(open, close + 1));
  } catch {
    return null;
  }
}

/* ── which photograph is the cover ────────────────────────────────
 * The same rule `HERO` applies in `lib/work.ts`: the project named by
 * `coverSlug`, and its first *portrait* frame — the cover runs the full
 * height of a column, so a landscape frame there loses its subject to the
 * crop.
 *
 * A resequenced gallery counts. `content/projects.json` can put a different
 * frame first, and `withSequence` makes the opener the cover on the site, so
 * it is the cover here too.
 * ─────────────────────────────────────────────────────────────── */
function coverFrame(projects, slug, overrides) {
  const project = projects.find((p) => p.slug === slug);
  if (!project?.images?.length) return null;

  const sequence = overrides[slug];
  if (sequence?.length) {
    // A passage names no file; the first entry that does is the opener.
    const first = sequence.find((f) => typeof f === "string" || f?.src);
    const src = typeof first === "string" ? first : first?.src;
    const found = project.images.find((f) => f.src === src);
    if (found) return found;
  }

  return project.images.find((f) => f.height > f.width) ?? project.images[0];
}

const sharp = await import("sharp")
  .then((m) => m.default)
  .catch(() => null);
if (!sharp) warn("sharp is not installed");

const site = (() => {
  try {
    return JSON.parse(readFileSync(join(root, "content/site.json"), "utf8"));
  } catch {
    return null;
  }
})();
if (!site?.coverSlug) warn("content/site.json has no coverSlug");

const overrides = (() => {
  try {
    return (
      JSON.parse(readFileSync(join(root, "content/projects.json"), "utf8"))
        .frames ?? {}
    );
  } catch {
    return {};
  }
})();

const projects = manifest();
if (!projects) warn("could not read the projects out of lib/work-data.ts");

const frame = coverFrame(projects, site.coverSlug, overrides);
if (!frame) warn(`no frame for coverSlug "${site.coverSlug}"`);

/* ── the crop ─────────────────────────────────────────────────────
 * `attention` rather than a centred crop. The cover is portrait and the card
 * is wide, so most of the frame is being thrown away — and a centre crop on a
 * standing figure takes the midriff. Attention picks the region with the most
 * going on in it, which on a portrait is the face far more often than not.
 * `north` would be right for a head-and-shoulders and wrong for anything shot
 * from further back.
 *
 * Quality starts at 82, matching the harvester, and steps down only if the
 * file is too big for the services above to fetch. Stepping is better than
 * failing: a slightly softer card still shows.
 * ─────────────────────────────────────────────────────────────── */
try {
  const source = join(root, "public", frame.src);
  let made;
  let quality = 82;

  for (; quality >= 60; quality -= 8) {
    made = await sharp(source)
      .resize(CARD.width, CARD.height, {
        fit: "cover",
        position: sharp.strategy.attention,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    if (made.length / 1024 <= MAX_KB) break;
  }

  writeFileSync(join(root, "public/og.jpg"), made);
  console.log(
    `og.jpg: ${frame.src} → ${CARD.width}x${CARD.height}, ${Math.round(
      made.length / 1024,
    )}KB at q${quality} (cover: ${site.coverSlug})`,
  );
} catch (e) {
  warn(`could not crop ${frame.src} (${e instanceof Error ? e.message : e})`);
}
