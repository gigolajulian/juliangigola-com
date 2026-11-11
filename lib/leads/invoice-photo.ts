import type { Crop } from "./invoice";

/* ── design B's photo column, framed ──────────────────────────────
 * One set of numbers for the desk's preview and the PDF: the photo covers
 * the column, `z` zooms past cover, `x`/`y` slide it like CSS
 * object-position. The PDF gets the column as one JPEG with the fade at
 * its foot baked in, so the PDF writer only places an image.
 * Browser only.
 * ─────────────────────────────────────────────────────────────── */

/** The column in PDF points: 41% of A4's width, full height. */
export const COL = { w: 594.96 * 0.41, h: 841.92 };
/** The wordmark's box on the photo, in points: where the tone is read. */
const MARK = { x: 26.8, y: 32.7, w: 128, h: 20 };
/** Pixels per point in the JPEG: about 216 dpi. */
const RES = 3;

/** Where the photo sits in a box of bw x bh: its size and offset. */
export function place(iw: number, ih: number, bw: number, bh: number, c: Crop) {
  const s = Math.max(bw / iw, bh / ih) * c.z, w = iw * s, h = ih * s;
  return { w, h, left: -(w - bw) * c.x, top: -(h - bh) * c.y };
}

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("Could not read the photo.")); i.src = src; });

/** A picked file, down to 2400 px on its long side, as a JPEG data URL: what is stored. */
export async function shrink(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url), k = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.88);
  } finally { URL.revokeObjectURL(url); }
}

/** Dark wordmark over a light patch, light over a dark one: the mean luminance under it. */
function toneOf(ctx: CanvasRenderingContext2D, k: number): "dark" | "light" {
  const d = ctx.getImageData(MARK.x * k, MARK.y * k, MARK.w * k, MARK.h * k).data;
  let L = 0;
  for (let i = 0; i < d.length; i += 4) L += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return L / (d.length / 4) / 255 > 0.45 ? "dark" : "light";
}

/** The column as drawn: canvas with the photo framed, and the tone under the wordmark. */
function draw(img: HTMLImageElement, c: Crop, k: number) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(COL.w * k); cv.height = Math.round(COL.h * k);
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
  const p = place(img.naturalWidth, img.naturalHeight, cv.width, cv.height, c);
  ctx.drawImage(img, p.left, p.top, p.w, p.h);
  return { cv, ctx, tone: toneOf(ctx, k) };
}

/** The tone alone, cheap enough for every drag. */
export const toneFor = (img: HTMLImageElement, c: Crop) => draw(img, c, 0.5).tone;

/** The column for the PDF: JPEG bytes with the fade at the foot, and the tone. */
export async function framed(src: string, c: Crop) {
  const { cv, ctx, tone } = draw(await loadImage(src), c, RES);
  // The page's fade: clear at 55% down, #0D0D0F at 85% at the foot.
  const g = ctx.createLinearGradient(0, cv.height * 0.55, 0, cv.height);
  g.addColorStop(0, "rgba(13,13,15,0)"); g.addColorStop(1, "rgba(13,13,15,0.85)");
  ctx.fillStyle = g; ctx.fillRect(0, cv.height * 0.55, cv.width, cv.height * 0.45);
  const blob = await new Promise<Blob>((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error("Could not frame the photo."))), "image/jpeg", 0.86));
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), w: cv.width, h: cv.height, tone };
}
