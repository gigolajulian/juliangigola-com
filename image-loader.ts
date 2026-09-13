import type { ImageLoaderProps } from "next/image";
import SIZED from "./public/work/sized.json";

/**
 * Every photograph on the site goes through here.
 *
 * There is no server-side optimizer on Workers, so resizing and re-encoding
 * are done by Cloudflare Image Transformations, addressed as a path prefix on
 * the zone: `/cdn-cgi/image/<options>/<source>`.
 *
 * This replaces a loader that did nothing. Under the GitHub Pages export it
 * prefixed a basePath and **ignored `width` entirely**, so every `srcSet`
 * candidate resolved to the same file and a phone downloaded the same 1600px
 * JPEG as a 5K display. The `sizes` props already written into every
 * component — `100vw` in the lightbox, `(min-width: 1024px) 45vw, 100vw` in
 * the cover — were correct all along and simply had nothing to act on.
 *
 * `format=auto` is the other half: AVIF or WebP to browsers that accept them,
 * which is typically 30-50% off the JPEG at the same quality and the single
 * largest speed win available here.
 *
 * Known limits, each of which looks like a bug if you meet it unprepared:
 *
 *   - `/cdn-cgi/image/` exists only on a Cloudflare **zone**. On
 *     `*.workers.dev` these URLs 404, so previews serve nothing. Judge images
 *     on the custom domain.
 *   - A custom loader bypasses `remotePatterns`; Next will not check the R2
 *     origin and neither will it allow it. The bucket's domain has to be
 *     allow-listed under Image Transformations in the Cloudflare dashboard.
 *   - Transformations are off by default on a zone and have to be enabled.
 */

/**
 * Transformations are opt-in rather than keyed off `NODE_ENV`.
 *
 * `opennextjs-cloudflare preview` runs a real Worker with `NODE_ENV` set to
 * production, so keying on that would rewrite every image onto a
 * `/cdn-cgi/` path that does not exist on localhost — a preview full of
 * broken frames, for the one build you most want to trust. Off unless the
 * deployed environment says otherwise.
 */
const CDN = process.env.NEXT_PUBLIC_IMAGE_CDN === "1";

/** Where the archive actually lives. Set per environment; see `.env.example`. */
const R2_ORIGIN = process.env.NEXT_PUBLIC_IMAGE_ORIGIN ?? "";

/**
 * The harvested archive is the only thing on R2 — 275MB of it, and ~690MB
 * once it is re-harvested at 2500px, which is why it is not in the repo.
 *
 * `public/hero` and `public/covers` are a few megabytes of hand-made frames
 * and stay with the app, so they are already served from this origin and want
 * no prefix.
 */
const onR2 = (src: string) => src.startsWith("/work/");

/**
 * The widths `scripts/make-hero.mjs` writes for `public/hero/*.jpg`. Keep the
 * two lists in step: a width named here that was not generated is a 404.
 */
const HERO_WIDTHS = [640, 1080, 1920];

/**
 * The sized copy of a picture for a slot `width` wide, or null when it has
 * none. Two sources of copies, one rule: the hero's four frames by name, and
 * whatever `scripts/make-cards.mjs` listed in `sized.json` — project covers
 * and the frames the homepage tiles scrub through.
 *
 * The smallest copy that is wide enough; past the widest, the widest. Never
 * the original for a picture that has copies: the original of a scrub frame
 * is 1.6MB, and a 5K screen is not a reason to send it.
 */
function sizedHero(src: string, width: number): string | null {
  const m = /^\/hero\/([a-z0-9-]+)\.jpg$/i.exec(src);
  const widths = m ? HERO_WIDTHS : (SIZED as Record<string, number[]>)[src];
  if (!widths) return null;
  const w =
    widths.find((candidate) => candidate >= width) ?? widths[widths.length - 1];
  return src.replace(/\.jpg$/i, `-w${w}.jpg`);
}

export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  // An absolute URL is somebody else's and is already complete.
  if (!src.startsWith("/")) return src;

  // The sized copy when there is one, with or without the resizer.
  //
  // Without transformations it is the whole answer: the archive's bare path
  // and `width` unused, except for the pictures `make-hero` and `make-cards`
  // sized at build. *With* them it still matters, and this was missed: the
  // resizer never upscales, and every project's `cover.jpg` is a 600px
  // harvest from the old site. Fed the original, a 769px tile on a 1.5x
  // screen got a 600px picture stretched to 1150 — soft on the homepage,
  // and visibly sharpening mid-trip as the morph landed on the project's
  // 1920px frame. The 1080px copy exists for exactly this; hand the resizer
  // that, and it only ever scales down.
  const picked = sizedHero(src, width) ?? src;
  const source = onR2(picked) ? R2_ORIGIN + picked : picked;

  if (!CDN) return source;

  const options = [
    `width=${width}`,
    // Matches the quality the harvester writes, so a transform never spends
    // bytes re-describing compression artefacts it cannot remove.
    `quality=${quality ?? 82}`,
    "format=auto",
  ];

  // The source goes in without its leading slash: the format is
  // `/cdn-cgi/image/<options>/<path>`, and a second slash in the path is a
  // different URL — a different cache key and a different counted
  // transformation for the same picture.
  return `/cdn-cgi/image/${options.join(",")}/${source.replace(/^\//, "")}`;
}
