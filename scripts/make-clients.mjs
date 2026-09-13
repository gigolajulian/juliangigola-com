/**
 * Client marks, from `assets/clients/` into something the site can draw.
 *
 * Drop a file in named for the client's key — `wired-magazine.svg`,
 * `ukiyosunknown.png` — and run this. The band under the cover and the wall on
 * /studio draw the mark instead of the name; a client with no file keeps its
 * wordmark, so the section is never half-built.
 *
 *   node scripts/make-clients.mjs
 *
 * Sources live outside `public/` on purpose: what a brand sends is a 1629px
 * PNG with a page of transparent margin around it, and that is not what should
 * be served. This reads the source, works out what to do with it, and writes
 * the web version.
 *
 * ── one colour, whatever the file is ─────────────────────────────
 * Every mark ends up drawn in `currentColor`, because three things need it and
 * a plain `<img>` gives none of them: the marks sit muted so they do not
 * compete with the work, each comes up to full contrast under the pointer, and
 * a black logo would be invisible on the dark theme — which is the default
 * here. Two routes to that:
 *
 *   SVG  inlined into `lib/clients-data.ts` with every fill and stroke
 *        rewritten to `currentColor`. Needs a single-colour source: a two-tone
 *        mark comes out flat.
 *
 *   PNG  trimmed to its own ink and served from `public/clients/`, then drawn
 *        as a CSS mask over `currentColor`. The alpha channel *is* the mark, so
 *        a transparent PNG needs no vector at all and keeps its antialiasing.
 *        A file with no transparency — black on white, or white on black —
 *        has its alpha taken from its own contrast, so either lockup works.
 *
 * Generated and committed, like `work-data.ts` and `cover-art-data.ts` — a
 * client is added a few times a year, which is not a build-time concern.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "assets/clients");
const served = join(root, "public/clients");
const to = join(root, "lib/clients-data.ts");

mkdirSync(served, { recursive: true });

const files = existsSync(from)
  ? readdirSync(from).filter((f) => /\.(svg|png)$/i.test(f))
  : [];

/**
 * The inside of an SVG, with every colour handed to `currentColor`.
 *
 * Deliberately narrow, and it refuses rather than half-converts: a mark that
 * came through with a `<style>` block half-applied would render, wrongly, and
 * the failure would show up as one logo that ignores hover.
 */
function inlineSvg(svg, name) {
  /* A viewBox, or the width and height to build one from.

     Plenty of real brand files carry only `width`/`height` — WIRED's own
     `logo.svg` is 125x25 with no viewBox — and refusing those would mean
     hand-editing every asset a client sends. Derived rather than assumed: if
     there is no viewBox and no numeric size, there is no way to scale the
     mark and it is refused. */
  const declared = svg.match(/viewBox="([^"]+)"/i)?.[1];
  const width = Number(svg.match(/\swidth="(\d*\.?\d+)(?:px)?"/i)?.[1]);
  const height = Number(svg.match(/\sheight="(\d*\.?\d+)(?:px)?"/i)?.[1]);
  const viewBox =
    declared ?? (width && height ? `0 0 ${width} ${height}` : undefined);
  if (!viewBox)
    throw new Error(
      `${name}: no viewBox and no width/height — nothing to scale it by`,
    );

  if (/<(style|linearGradient|radialGradient|image)\b/i.test(svg))
    throw new Error(
      `${name}: has a style block, gradient or raster. Flatten it to paths in one colour first.`,
    );

  /* An SVG is a document and may carry script — a `<script>` element, or an
     `onload` on any node. This markup is injected with
     `dangerouslySetInnerHTML`, and the site's CSP allows inline script
     (Next's hydration payload needs it), so such a script would run.

     Refused rather than stripped. A logo has no reason to contain either, so a
     file that does is either broken or not a logo, and quietly removing part
     of it would publish a mark nobody had looked at. */
  if (/<script\b/i.test(svg) || /\son[a-z]+\s*=/i.test(svg))
    throw new Error(
      `${name}: contains script or an event handler. A logo needs neither — export it again as plain paths.`,
    );

  /* Same reasoning for anything reaching outside the file: a mark that loads
     from a URL can be changed by somebody else, and `foreignObject` is a hole
     straight back into HTML. */
  if (/<foreignObject\b/i.test(svg) || /<use\b[^>]*href="(?!#)/i.test(svg))
    throw new Error(
      `${name}: references something outside the file. Flatten it first.`,
    );

  const body = svg
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>[\s\S]*$/i, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(title|desc|metadata)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/(fill|stroke)="(?!none\b)[^"]*"/gi, '$1="currentColor"')
    .replace(/(fill|stroke):\s*(?!none\b)[^;"']+/gi, "$1:currentColor")
    .replace(/\s+/g, " ")
    .trim();

  if (!body) throw new Error(`${name}: nothing inside the svg`);
  return { kind: "svg", viewBox, body };
}

/**
 * A PNG, cropped to its own ink and written where it can be served.
 *
 * `sharp`'s own `trim` keys off the corner *colour*, which on a transparent
 * file means it finds nothing to do — the Ukiyo mark arrived 1629px square
 * with the logo occupying the middle third, and trim returned it unchanged.
 * So the alpha bounding box is computed here: anything above a low threshold
 * counts as ink, which ignores the stray near-zero pixels an export leaves
 * behind without eating a soft edge.
 */
async function maskPng(file, slug, name) {
  let source = file;

  /* A file with no transparency at all, turned into one.
   *
   * Half of what a brand sends is the logo flattened onto a ground — black on
   * white from a print file, or white on black from a dark lockup. The alpha
   * channel is then uniformly opaque and the crop below would find the whole
   * canvas, so the mark would render as a solid rectangle.
   *
   * The ink is recoverable, because these files are one colour on one ground:
   * the *contrast* is the alpha. Which way round it goes is read off the four
   * corners rather than assumed — a dark corner means light ink, a light
   * corner means dark ink — and using luminance rather than a threshold keeps
   * the antialiased edge that a threshold would turn into a staircase.
   */
  /* `stats()` reads the file as it is on disk and ignores anything queued in
     the pipeline, so `ensureAlpha().stats()` reports three channels for a file
     that has three — which is the very case being tested for. Metadata first,
     then the alpha channel only where there is one. */
  const meta = await sharp(file).metadata();
  const opaque =
    !meta.hasAlpha ||
    (await sharp(file).stats().then((st) => st.channels[3].min >= 250));

  if (opaque) {
    const flat = await sharp(file)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = flat.info;
    const lum = (x, y) => {
      const i = (y * width + x) * channels;
      return (flat.data[i] + flat.data[i + 1] + flat.data[i + 2]) / 3;
    };
    const corners = [
      lum(0, 0),
      lum(width - 1, 0),
      lum(0, height - 1),
      lum(width - 1, height - 1),
    ];
    const ground = corners.reduce((a, b) => a + b, 0) / 4;
    const inkIsLight = ground < 128;

    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const l =
        (flat.data[i * channels] +
          flat.data[i * channels + 1] +
          flat.data[i * channels + 2]) /
        3;
      // The mark is always written as black ink; only the alpha carries the
      // shape, and `currentColor` supplies the colour at render.
      rgba[i * 4] = 0;
      rgba[i * 4 + 1] = 0;
      rgba[i * 4 + 2] = 0;
      rgba[i * 4 + 3] = Math.round(inkIsLight ? l : 255 - l);
    }

    source = await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer();
    console.log(
      `  ${name}: no transparency — alpha taken from contrast (${inkIsLight ? "light" : "dark"} ink on a ${inkIsLight ? "dark" : "light"} ground)`,
    );
  }

  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let top = info.height;
  let left = info.width;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] <= 8) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }

  if (right < 0)
    throw new Error(
      `${name}: nothing in it. An empty canvas, or a mark the same colour as its own ground.`,
    );

  const width = right - left + 1;
  const height = bottom - top + 1;

  /* Capped at 320px tall. A mark is drawn at 24px and at most twice that on a
     dense screen, so a 1629px source is three orders of magnitude of bytes
     nobody sees — and a mask is fetched by every visitor. */
  const out = join(served, `${slug}.png`);
  await sharp(source)
    .extract({ left, top, width, height })
    .resize({ height: Math.min(height, 320), withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(out);

  const final = await sharp(out).metadata();
  return {
    kind: "mask",
    src: `/clients/${slug}.png`,
    width: final.width,
    height: final.height,
    trimmedFrom: `${info.width}x${info.height}`,
  };
}

const marks = {};
for (const file of files) {
  const slug = file.replace(/\.(svg|png)$/i, "");
  const path = join(from, file);
  marks[slug] = file.toLowerCase().endsWith(".svg")
    ? inlineSvg(readFileSync(path, "utf8"), file)
    : await maskPng(path, slug, file);
}

const entries = Object.entries(marks)
  .map(([slug, m]) => {
    const fields =
      m.kind === "svg"
        ? `    kind: "svg",\n    viewBox: ${JSON.stringify(m.viewBox)},\n    body: ${JSON.stringify(m.body)},`
        : `    kind: "mask",\n    src: ${JSON.stringify(m.src)},\n    width: ${m.width},\n    height: ${m.height},`;
    return `  ${JSON.stringify(slug)}: {\n${fields}\n  },`;
  })
  .join("\n");

writeFileSync(
  to,
  `/* Generated by \`scripts/make-clients.mjs\` from \`assets/clients/\`.
 * Do not edit: add or replace a file there and run the script.
 *
 * Every mark is drawn in \`currentColor\` — an inlined SVG, or a PNG's alpha
 * used as a CSS mask — so it sits muted in the row, comes up to full contrast
 * on hover, and works on either theme. See the script for why.
 */

/** A mark drawn from paths. Colours are already \`currentColor\`. */
export type VectorMark = { kind: "svg"; viewBox: string; body: string };

/** A mark drawn by masking \`currentColor\` with a PNG's alpha channel. */
export type RasterMark = {
  kind: "mask";
  src: string;
  width: number;
  height: number;
};

export type ClientMarkData = VectorMark | RasterMark;

/** By the client's key. Absent means that client keeps its wordmark. */
export const CLIENT_MARKS: Record<string, ClientMarkData> = {
${entries}
};
`,
);

const summary = Object.entries(marks)
  .map(
    ([slug, m]) =>
      `  ${slug}: ${m.kind === "svg" ? `svg, viewBox ${m.viewBox}` : `mask, ${m.width}x${m.height} (from ${m.trimmedFrom})`}`,
  )
  .join("\n");

console.log(
  files.length
    ? `${files.length} mark${files.length === 1 ? "" : "s"}:\n${summary}`
    : "no files in assets/clients yet — every client keeps its wordmark",
);
