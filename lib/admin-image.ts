/**
 * What `scripts/harvest.mjs` does to a photograph, done in the browser.
 *
 * A frame added through `/admin` has to arrive in the repo in exactly the
 * state a harvested one is in, or it will look different on the page for
 * reasons nobody will think to look for: a different size means a different
 * crop in the cover column, and a missing mat colour means a frame that snaps
 * in against grey instead of settling in against itself.
 *
 * So the same three numbers are produced here — 2500px wide, mozjpeg-ish q82,
 * and the image's *mean* colour — using a canvas rather than sharp.
 *
 * The one honest difference is the encoder. `canvas.toBlob` is the browser's
 * JPEG encoder, not mozjpeg, so the file is typically 5-15% larger than the
 * harvester would have made it at the same quality. Not worth shipping a wasm
 * encoder to close: it costs a megabyte of JavaScript on a page used a few
 * times a month, and Cloudflare re-encodes everything on the way out anyway.
 */

/** Format's largest render, and what the archive is stored at. */
export const MAX_WIDTH = 2500;

/** The small copy indexes and hover previews use. */
export const COVER_WIDTH = 600;

const QUALITY = 0.82;

export type ProcessedImage = {
  /** JPEG bytes, base64, ready for a git blob. */
  base64: string;
  width: number;
  height: number;
  /** `#rrggbb`, the image's mean — the mat drawn behind the frame. */
  color: string;
  bytes: number;
};

const hex = (n: number) => n.toString(16).padStart(2, "0");

/**
 * Base64 in chunks.
 *
 * `String.fromCharCode(...bytes)` on a 700KB photograph blows the argument
 * limit and throws a range error — which surfaces as "upload failed" on large
 * files only, and works on every small test image.
 */
const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
};

const draw = (
  source: ImageBitmap,
  width: number,
  height: number,
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser would not give a 2D canvas.");
  // The browser's own downscaler, asked for its best effort — the default on
  // a large reduction is visibly harsher than sharp's.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
};

const encode = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("The browser could not encode a JPEG.")),
      "image/jpeg",
      QUALITY,
    ),
  );

/**
 * The mean colour: the image reduced to a small grid, then averaged by hand.
 *
 * Not a straight resize to 1x1, which is the obvious version and is wrong
 * often enough to matter. Browsers are free to reach a single pixel however
 * they like, and measured against sharp's own mean the one-pixel answer came
 * back up to 14/255 out on a sunset frame — enough for the mat behind a
 * photograph to read as the wrong temperature. Over a 32x32 reduction the
 * averaging is ours rather than the downscaler's, and it lands within about
 * 2/255.
 *
 * Deliberately the mean and not the dominant: on a sunset frame the dominant
 * bucket comes back near-black, which reads as a letterbox bar rather than a
 * mount. See the note on `COVER_OVERRIDES` in `lib/work.ts`.
 */
const GRID = 32;

const meanColour = (source: ImageBitmap): string => {
  const pixels = draw(source, GRID, GRID)
    .getContext("2d")!
    .getImageData(0, 0, GRID, GRID).data;

  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    r += pixels[i];
    g += pixels[i + 1];
    b += pixels[i + 2];
  }

  const n = pixels.length / 4;
  return `#${hex(Math.round(r / n))}${hex(Math.round(g / n))}${hex(Math.round(b / n))}`.toUpperCase();
};

/** Resizes to at most `maxWidth`, never up: upscaling adds bytes, not detail. */
export async function processImage(
  file: File,
  maxWidth: number,
): Promise<ProcessedImage> {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
    throw new Error(
      `${file.name} is a ${file.type || "unknown type"}, not a photograph.`,
    );
  }

  const source = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxWidth / source.width);
    const width = Math.round(source.width * scale);
    const height = Math.round(source.height * scale);

    const blob = await encode(draw(source, width, height));
    return {
      base64: toBase64(await blob.arrayBuffer()),
      width,
      height,
      color: meanColour(source),
      bytes: blob.size,
    };
  } finally {
    // These hold decoded bitmaps — a dozen full-size frames is hundreds of
    // megabytes if they are left to the collector.
    source.close();
  }
}

/** `Some Shoot Name` → `some-shoot-name`, which is both a route and a folder. */
export const toSlug = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
