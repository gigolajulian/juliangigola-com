/**
 * Every raster icon, from the one SVG.
 *
 * `app/icon.svg` is the source and the only thing to edit. This writes what
 * cannot be an SVG:
 *
 *   app/favicon.ico          16, 32 and 48, for /favicon.ico and old browsers
 *   app/apple-icon.png       180, for an iOS home screen
 *   app/opengraph-image.png  1200x630, the card when the site is shared
 *
 * Committed rather than generated at build time. They change when the mark
 * changes, which is roughly never, and a build step that needs `sharp` on the
 * Cloudflare builder is a dependency for nothing.
 *
 *   node scripts/make-icons.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = await readFile(join(root, "app/icon.svg"));

/* ── the mark at 16 pixels is a different drawing ─────────────────
 * Rendered straight, the full mark turns to mud at 16px: the white ring
 * between the pupil and the iris is about one pixel, so the pupil dissolves
 * into the iris and the lids blur into the ground. Compared side by side at
 * 6x, the pupil is not a detail that survives — it is the thing making the
 * centre grey.
 *
 * So the smallest size drops it and opens the aperture slightly. The
 * silhouette is the same mark — a lens with a dark iris in it — and it is the
 * silhouette that identifies a favicon at the size a tab actually gives it.
 * Size-specific drawings are what icon sets have always done; the alternative
 * is one drawing that looks right at one size.
 * ─────────────────────────────────────────────────────────────── */
const SMALL = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">` +
    `<rect width="100" height="100" fill="#000"/>` +
    `<path d="M4 50 C 21 18, 79 18, 96 50 C 79 82, 21 82, 4 50 Z" fill="#fff"/>` +
    `<circle cx="50" cy="50" r="20" fill="#000"/>` +
    `</svg>`,
);

/** The mark at one size, as PNG. Under 24px it is the simplified drawing. */
const png = (size) =>
  sharp(size < 24 ? SMALL : svg, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toBuffer();

/* ── favicon.ico ──────────────────────────────────────────────────
 * An ICO is a small directory of images, and each entry may be a PNG rather
 * than a bitmap — every browser that still asks for a .ico reads PNG ones.
 * So it is a header, one entry per size, then the PNGs.
 *
 * Three sizes because the file is asked for at three: 16 in a tab, 32 in a
 * bookmark bar and on a HiDPI tab, 48 in Windows' own lists. Letting the
 * browser scale one 48 down to 16 is how a mark turns to mush at the size it
 * is seen most.
 * ─────────────────────────────────────────────────────────────── */
const SIZES = [16, 32, 48];
const images = await Promise.all(SIZES.map(png));

const HEADER = 6;
const ENTRY = 16;
const dir = Buffer.alloc(HEADER + ENTRY * images.length);
dir.writeUInt16LE(0, 0); // reserved
dir.writeUInt16LE(1, 2); // 1 = icon, not cursor
dir.writeUInt16LE(images.length, 4);

let offset = dir.length;
images.forEach((buf, i) => {
  const at = HEADER + i * ENTRY;
  // 256 is written as 0 in this field, which is the whole reason it is a byte.
  dir.writeUInt8(SIZES[i] >= 256 ? 0 : SIZES[i], at);
  dir.writeUInt8(SIZES[i] >= 256 ? 0 : SIZES[i], at + 1);
  dir.writeUInt8(0, at + 2); // palette colours: none, it is a PNG
  dir.writeUInt8(0, at + 3); // reserved
  dir.writeUInt16LE(1, at + 4); // colour planes
  dir.writeUInt16LE(32, at + 6); // bits per pixel
  dir.writeUInt32LE(buf.length, at + 8);
  dir.writeUInt32LE(offset, at + 12);
  offset += buf.length;
});

await writeFile(
  join(root, "app/favicon.ico"),
  Buffer.concat([dir, ...images]),
);

/* ── the home screen ─────────────────────────────────────────────
 * No transparency and no rounding: iOS masks the corners itself, and a mark
 * that has already rounded its own gets clipped twice.
 * ─────────────────────────────────────────────────────────────── */
await writeFile(join(root, "app/apple-icon.png"), await png(180));

/* ── the share card ──────────────────────────────────────────────
 * 1200x630 is what every unfurler crops to, and `twitter: card:
 * summary_large_image` was already declared in `app/layout.tsx` with no image
 * behind it — a large-image card with nothing in it, which unfurls as a blank
 * slab with the title beside it.
 *
 * The mark on its own ground rather than a photograph. A photograph would say
 * more about the work, and it would also be one photograph standing for
 * thirteen disciplines and seventy-three projects, chosen once and then wrong
 * for every link that is not about it. The title and description travel with
 * the card and say what the site is; the image says whose it is.
 *
 * Sized so the eye reads at the width a link preview actually gets — a third
 * of the card, which in a phone's chat window is about 40px of mark.
 * ─────────────────────────────────────────────────────────────── */
const OG = { width: 1200, height: 630, mark: 380 };

await sharp({
  create: {
    width: OG.width,
    height: OG.height,
    channels: 3,
    // The same #000 as the mark's own ground, so there is no seam.
    background: { r: 0, g: 0, b: 0 },
  },
})
  .composite([{ input: await png(OG.mark), gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toFile(join(root, "app/opengraph-image.png"));

console.log("icons written: favicon.ico (16/32/48), apple-icon.png, opengraph-image.png");
