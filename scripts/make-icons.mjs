/**
 * Every raster icon, from the one SVG.
 *
 * `app/icon.svg` is the source and the only thing to edit. This writes what
 * cannot be an SVG:
 *
 *   app/favicon.ico          16, 32 and 48, for /favicon.ico and old browsers
 *   app/apple-icon.png       180, for an iOS home screen
 * *
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

/* The mark is "JG" in Inter Tight 900, bleeding off the right edge
 * (Julian's 1b, 2026-10-25), outlined to a path so no font is needed. Two
 * heavy letters hold at 16px, so every size is the same drawing. */

/** The mark at one size, as PNG. */
const png = (size) =>
  sharp(svg, { density: 384 })
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

console.log("icons written: favicon.ico (16/32/48), apple-icon.png");
