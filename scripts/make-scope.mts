/* Samples every project's colours for the Colour view on /work.
 *
 *   npm run scope
 *
 * Six frames a project, each shrunk to 12x15 so every point stands for a
 * patch of the picture rather than a pixel, and the near-greys dropped: a
 * grey sits in the middle of the scope and says nothing about the palette.
 * Only RGB is stored; `components/vectorscope.tsx` works out where each
 * one sits. Written to `public/scope.json`, keyed by slug, which the view
 * fetches the first time it is opened.
 *
 * Run it after adding a project. One added since the last run is left off
 * the scope rather than breaking anything.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECTS } from "../lib/work";

const sharp = createRequire(import.meta.url)("sharp");
const FRAMES = 6;
const PER_FRAME = 40;

const chroma = (r: number, g: number, b: number) =>
  Math.hypot(-0.1687 * r - 0.3313 * g + 0.5 * b, 0.5 * r - 0.4187 * g - 0.0813 * b);

const out: Record<string, number[]> = {};
for (const p of PROJECTS) {
  const frames = p.images.filter((f) => f.src.startsWith("/work/")).slice(0, FRAMES);
  const pts: number[] = [];
  for (const f of frames) {
    const { data } = await sharp(join("public", f.src))
      .resize(12, 15, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const px: number[][] = [];
    for (let i = 0; i < data.length; i += 3)
      if (chroma(data[i], data[i + 1], data[i + 2]) > 1.5) px.push([data[i], data[i + 1], data[i + 2]]);
    // Evenly through the frame, so the cap keeps the spread, not the top rows.
    const step = Math.max(1, px.length / PER_FRAME);
    for (let k = 0, n = 0; k < px.length && n < PER_FRAME; k += step, n++) pts.push(...px[Math.floor(k)]);
  }
  if (pts.length) out[p.slug] = pts;
}
writeFileSync("public/scope.json", JSON.stringify(out));
console.log(Object.keys(out).length, "projects,", Object.values(out).reduce((n, v) => n + v.length / 3, 0), "points");
