/* Samples every photograph's colours for the colour panel on /work.
 *
 *   npm run scope
 *
 * Every frame of every project, each shrunk to 12x15 so a point stands for
 * a patch of the picture rather than a pixel, with the near-greys dropped:
 * a grey sits in the middle of the scope and says nothing about the
 * palette. Written to `public/scope.json`, keyed by slug, one entry a
 * frame:
 *
 *   [src, width, height, colour, dominant, r, g, b, r, g, b, ...]
 *
 * The frame's own fields are there so the panel can show the frame and
 * open it in the viewer without the project data; `dominant` is sharp's
 * histogram peak, for the swatches over each set. Only RGB is stored;
 * `components/vectorscope.tsx` works out where each point sits. The panel
 * fetches the file the first time it is opened.
 *
 * Run it after adding a project. One added since the last run is left off
 * the panel rather than breaking anything.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECTS } from "../lib/work";

const sharp = createRequire(import.meta.url)("sharp");
const PER_FRAME = 20;

const chroma = (r: number, g: number, b: number) =>
  Math.hypot(-0.1687 * r - 0.3313 * g + 0.5 * b, 0.5 * r - 0.4187 * g - 0.0813 * b);
const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

type Entry = [string, number, number, string, string, ...number[]];
const out: Record<string, Entry[]> = {};
let frames = 0;
for (const p of PROJECTS) {
  const entries: Entry[] = [];
  for (const f of p.images.filter((f) => f.src.startsWith("/work/"))) {
    const img = sharp(join("public", f.src));
    const { dominant } = await img.clone().stats();
    const { data } = await img
      .resize(12, 15, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const px: number[][] = [];
    for (let i = 0; i < data.length; i += 3)
      if (chroma(data[i], data[i + 1], data[i + 2]) > 1.5) px.push([data[i], data[i + 1], data[i + 2]]);
    // Evenly through the frame, so the cap keeps the spread, not the top rows.
    const pts: number[] = [];
    const step = Math.max(1, px.length / PER_FRAME);
    for (let k = 0, n = 0; k < px.length && n < PER_FRAME; k += step, n++) pts.push(...px[Math.floor(k)]);
    entries.push([
      f.src,
      f.width,
      f.height,
      f.color ?? "#111111",
      hex(dominant.r, dominant.g, dominant.b),
      ...pts,
    ]);
  }
  if (entries.length) {
    out[p.slug] = entries;
    frames += entries.length;
  }
}
writeFileSync("public/scope.json", JSON.stringify(out));
console.log(Object.keys(out).length, "projects,", frames, "frames");
