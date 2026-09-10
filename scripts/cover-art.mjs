/**
 * Builds the cover-art set from Julian's masters.
 *
 * Separate from `harvest.mjs` on purpose. The harvester pulls what the old
 * Format site published — 1600px re-compressions of covers, with the release
 * titles stuffed into alt text and zero-width spaces baked in. These are the
 * delivery files: up to 7952px, and they include a release the old site never
 * showed. So this is the source of truth for cover art, and the harvester's
 * `coverart` gallery is overridden by it (see `lib/work.ts`).
 *
 * Run:  node scripts/cover-art.mjs
 *
 * Writes `public/covers/*.jpg` and generates `lib/cover-art-data.ts`.
 */

import sharp from "sharp";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const SRC = "PICS/ALL COVERARTS";
const OUT_DIR = "public/covers";
const DATA = "lib/cover-art-data.ts";

/** Matches the rest of the archive. Every cover is square, so this is both edges. */
const MAX = 1600;
const QUALITY = 82;
/** The small copy used wherever a cover appears as a thumbnail. */
const COVER = 600;

/**
 * The releases, in the order they read on the page.
 *
 * Two-sided releases lead. That is editorial — they are the two vinyl
 * packages, and the only pieces here that are a whole sleeve rather than a
 * single square — but it is also load-bearing: the grid places a two-sided
 * release as one double-wide cell, and starting with them is what keeps the
 * rows full at every breakpoint, which the check at the end of `main`
 * enforces.
 *
 * `file` is relative to SRC unless it contains a slash, in which case it is
 * relative to the repo root.
 */
const RELEASES = [
  {
    title: "Est Modvs In Rebvs",
    artist: "Nameera",
    sides: [
      { file: "FRONT - NAMEERA.jpg", side: "Front" },
      { file: "BACK - NAMEERA.jpg", side: "Back" },
    ],
  },
  {
    title: "Jahannam",
    artist: "Nameera",
    sides: [
      { file: "JAHANNAM - NAMEERA SIDE A.jpg", side: "Side A" },
      { file: "JAHANNAM - NAMEERA SIDE B.jpg", side: "Side B" },
    ],
  },
  { title: "Problem Child", artist: "BANX", sides: [{ file: "PROBLEM_CHILD_-_BANX_wex0nt.png" }] },
  { title: "Westside Shawty", artist: "BANX", sides: [{ file: "WESTSIDE SHAWTY-BANxx copy 3d@3 (Custom).png" }] },
  { title: "Top Tier", artist: "BANX", sides: [{ file: "TOP TIER - BANX.PNG" }] },
  { title: "Pop Out", artist: "BANX", sides: [{ file: "POP OUT - BANX [COVER].jpg" }] },
  { title: "Do What I Want", artist: "BANX", sides: [{ file: "ORIGINAL.png" }] },
  { title: "Savage", artist: "BANX", sides: [{ file: "SAVAGE - BANX.png" }] },
  { title: "Rockstar", artist: "BANX", sides: [{ file: "BANX - Rockstar.png" }] },
  { title: "Took Time", artist: "BANX", sides: [{ file: "TOOK TIME - BANX.jpg" }] },
  { title: "Whole Summer", artist: "BANX", sides: [{ file: "Whole Summer - Banx copy 2.jpg" }] },
  { title: "10 Shots", artist: "Sammy Shiblaq", sides: [{ file: "10 SHOTS - SAMMY SHIBLAQ_MAIN.jpg" }] },
  { title: "The Description", artist: "Sammy Shiblaq", sides: [{ file: "THE DESCRIPTION - SAMMY SHIBLAq.png" }] },
  { title: "Faith & Hustle", artist: "Sammy Shiblaq", sides: [{ file: "FAITH_HUSTLE_4.jpg" }] },
  {
    title: "Tomorrow Ain't Promised",
    artist: "Sammy Shiblaq",
    sides: [{ file: "TOMORROW AINT PROMISED - SAMMY SHIBLAQ.png" }],
  },
  { title: "The River", artist: "TMEUPTEDDY", sides: [{ file: "RIVER - TMEUPTEDDY.jpg" }] },
  { title: "New Home", artist: "Rechi", sides: [{ file: "NEW HOME - RECHI FINAL.jpg" }] },
  { title: "Your Way", artist: "The Szns ft. Swavie", sides: [{ file: "YOUR WAY - THE SZNS (@filmedbyjulian).jpg" }] },
  { title: "Hi-Fi", artist: "Parsia", sides: [{ file: "Hi-Fi.png" }] },
  {
    title: "Wasted Years (Parsia Remix)",
    artist: "London Grammar",
    sides: [{ file: "Wasted_Years_-_Parsia_Remix.png" }],
  },
  { title: "Area 51", artist: "KXP", sides: [{ file: "AREA_51_KXP.png" }] },
  { title: "Beamin", artist: "Karson", sides: [{ file: "BEAMIN_-_KARSON.png" }] },
  { title: "Hadaf", artist: "Imanemun × Pooyan Ardalan", sides: [{ file: "hadaf_barf_final.png" }] },
  {
    title: "In the Hoodie on Your Sleeve",
    artist: "Ericalisa",
    // The one release with no master in the folder. Kept from the harvested
    // copy so it does not silently drop out of the set — 1600px like the rest
    // of the archive, just not from an original. It lives beside this script
    // rather than in `PICS/` because `PICS/` is not in the repo, and this is
    // the one input that has to survive a fresh clone.
    sides: [{ file: "scripts/sources/in-the-hoodie-on-your-sleeve.jpg" }],
  },
];

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * The image's mean colour, used as the placeholder behind a cover while it
 * decodes.
 *
 * Deliberately not sharp's `dominant`, which returns the darkest populated
 * histogram bucket and hands back near-black for anything with shadows —
 * useless as a mat. The mean is the colour the frame actually reads as.
 */
const meanColor = async (image) => {
  const { channels } = await image.stats();
  const hex = channels
    .slice(0, 3)
    .map((c) => Math.round(c.mean).toString(16).padStart(2, "0"))
    .join("");
  return `#${hex.toUpperCase()}`;
};

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const available = new Set(await readdir(SRC));
  const out = [];

  for (const release of RELEASES) {
    const slug = slugify(release.title);
    const frames = [];

    for (const [i, { file, side }] of release.sides.entries()) {
      const local = file.includes("/");
      const src = local ? file : path.join(SRC, file);
      if (!local && !available.has(file)) {
        throw new Error(`Missing master: ${file}`);
      }

      const suffix = release.sides.length > 1 ? `-${"ab"[i]}` : "";
      const name = `${slug}${suffix}.jpg`;

      // A cover is square by definition, and one master is 2000×1997 — a
      // three-pixel export error. Left alone it renders as a landscape frame
      // and takes a full-width row to itself in the gallery, which is a
      // visible layout break caused by a rounding artefact. Anything within
      // 1% of square is squared off; anything genuinely not square is left
      // exactly as it is.
      const meta = await sharp(src).metadata();
      const square = Math.abs(meta.width - meta.height) / Math.max(meta.width, meta.height) < 0.01;

      // `withoutEnlargement` so a 780px cover is not upscaled into mush;
      // the manifest records what actually landed on disk.
      const pipeline = sharp(src).resize(MAX, MAX, {
        fit: square ? "cover" : "inside",
        withoutEnlargement: true,
      });
      const { width, height } = await pipeline
        .clone()
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toFile(path.join(OUT_DIR, name));

      frames.push({
        src: `/covers/${name}`,
        width,
        height,
        color: await meanColor(sharp(src)),
        alt: `Cover art for “${release.title}” by ${release.artist}${side ? ` — ${side.toLowerCase()}` : ""}`,
        side: side ?? null,
      });
    }

    out.push({ slug, title: release.title, artist: release.artist, frames });
  }

  // The gallery lays square frames out two per row, in sequence. A sleeve
  // therefore stays on one row only if its first side falls at an even index —
  // which is why the two-sided releases lead the set. Checked here, where the
  // ordering is decided, so reordering RELEASES fails loudly instead of
  // quietly wrapping side B onto the next row.
  let at = 0;
  for (const release of out) {
    if (release.frames.length > 1 && at % 2 !== 0) {
      throw new Error(
        `"${release.title}" has ${release.frames.length} sides but starts at frame ${at}, ` +
          `which splits it across two rows. Move multi-side releases to the front of RELEASES.`,
      );
    }
    at += release.frames.length;
  }

  // The thumbnail, from whatever leads the set.
  const lead = RELEASES[0].sides[0].file;
  await sharp(lead.includes("/") ? lead : path.join(SRC, lead))
    .resize(COVER, COVER, { fit: "inside" })
    .jpeg({ quality: QUALITY, mozjpeg: true })
    .toFile(path.join(OUT_DIR, "cover.jpg"));

  const ts = `/**
 * GENERATED by \`scripts/cover-art.mjs\`. Do not hand-edit — titles, artists
 * and ordering live in that script's RELEASES table.
 */

import type { CoverRelease } from "./cover-art-types";

export const COVER_RELEASES: CoverRelease[] = ${JSON.stringify(out, null, 2)};
`;

  await writeFile(DATA, ts, "utf8");

  const frameCount = out.reduce((n, r) => n + r.frames.length, 0);
  console.log(`${out.length} releases, ${frameCount} frames → ${OUT_DIR} + ${DATA}`);
}

await main();
