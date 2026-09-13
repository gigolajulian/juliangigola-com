/**
 * Sizes the pictures behind the cards, and makes their blur-ups.
 *
 * Two things the cards were paying for, measured:
 *
 *   - The homepage tiles scrub through three frames each, and those were the
 *     full-size originals — 7.6MB across 21 files, two of them over 1.2MB,
 *     downloaded on every desktop visit. A tile is a third of the screen
 *     wide; it wants a 1080px copy, not a 2500px one.
 *   - Every project's cover is a 600px derivative shown at ~480 CSS px, so on
 *     a retina screen it is upscaled and soft. The full-size frame it came
 *     from is on disk, so a 1080px copy can be cut from that.
 *
 * So, for every project: `cover-w1080.jpg` cut from the frame the cover was
 * made from — only when a 16px comparison says it is the same picture, or
 * the tile would show a different photograph — and a 16px blur-up of the
 * cover. For the featured projects: 640 and 1080px copies of the three
 * frames each tile scrubs through, in the order the admin panel sequences
 * them (`content/projects.json` overrides the manifest's order).
 *
 * The loader (`image-loader.ts`) reads `public/work/sized.json` to know
 * which paths have copies and at what widths, and never hands out an
 * original for one that does. The copies are committed rather than built,
 * because Cloudflare's builds are fresh clones and Julian's build minutes
 * are finite; this script is for regenerating them when the pictures or the
 * featured set change, and it skips anything already up to date.
 *
 * Like the other generators, it must never fail a build.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_SIZED = "public/work/sized.json";
const OUT_BLUR = "public/work/blur.json";
const COVER_WIDTHS = [1080];
const FRAME_WIDTHS = [640, 1080];
const SCRUB_FROM = 1;
const SCRUB_COUNT = 3;
const BLUR_WIDTH = 16;
/** Mean per-pixel difference at 16px below which two files are one picture. */
const SAME_PICTURE = 6;

const fresh = (source, target) => {
  try {
    return statSync(target).mtimeMs >= statSync(source).mtimeMs;
  } catch {
    return false;
  }
};
const variant = (src, w) => src.replace(/\.jpg$/i, `-w${w}.jpg`);
const onDisk = (src) => join("public", src);

try {
  const { default: sharp } = await import("sharp");
  const { PROJECTS } = await import("../lib/work-data.ts");
  const site = JSON.parse(readFileSync("content/site.json", "utf8"));
  const overrides = JSON.parse(readFileSync("content/projects.json", "utf8"));
  const featured = new Set(site.featured ?? []);

  const thumb = async (path) =>
    sharp(path).resize(BLUR_WIDTH, BLUR_WIDTH, { fit: "fill" }).greyscale().raw().toBuffer();
  const distance = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

  const sized = {};
  const blur = {};
  let made = 0;

  const cut = async (source, src, w) => {
    const target = onDisk(variant(src, w));
    if (!fresh(source, target)) {
      await sharp(source)
        .resize({ width: w, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(target);
      made += 1;
    }
    (sized[src] ??= []).push(w);
  };

  for (const project of PROJECTS) {
    const sequence = overrides.frames?.[project.slug];
    const images = sequence
      ? sequence.map((s) => project.images.find((f) => f.src === s)).filter(Boolean)
      : project.images;
    const cover = project.cover?.src;
    if (!cover || !existsSync(onDisk(cover))) continue;

    // The cover, re-cut from the full-size frame it was made from.
    const first = images[0]?.src;
    if (first && existsSync(onDisk(first))) {
      const [a, b] = await Promise.all([thumb(onDisk(cover)), thumb(onDisk(first))]);
      if (distance(a, b) < SAME_PICTURE) {
        for (const w of COVER_WIDTHS) await cut(onDisk(first), cover, w);
      }
    }

    // Its blur-up, inlined under the tile while the picture loads.
    const tiny = await sharp(onDisk(cover)).resize({ width: BLUR_WIDTH }).jpeg({ quality: 50 }).toBuffer();
    blur[cover] = `data:image/jpeg;base64,${tiny.toString("base64")}`;

    // The three frames a homepage tile scrubs through.
    if (featured.has(project.slug)) {
      for (const frame of images.slice(SCRUB_FROM, SCRUB_FROM + SCRUB_COUNT)) {
        if (!existsSync(onDisk(frame.src))) continue;
        for (const w of FRAME_WIDTHS) await cut(onDisk(frame.src), frame.src, w);
      }
    }
  }

  for (const [file, data] of [
    [OUT_SIZED, sized],
    [OUT_BLUR, blur],
  ]) {
    const json = JSON.stringify(data, null, 2) + "\n";
    let changed = true;
    try {
      changed = readFileSync(file, "utf8") !== json;
    } catch {}
    if (changed) writeFileSync(file, json);
  }

  console.log(
    `make-cards: ${made} sized copies written; ${Object.keys(sized).length} pictures sized, ${Object.keys(blur).length} blur-ups`,
  );
} catch (e) {
  console.warn(`make-cards: skipped — ${e instanceof Error ? e.message : e}`);
}
