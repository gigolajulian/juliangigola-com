import type { ImageLoaderProps } from "next/image";
import SIZED from "./public/work/sized.json";
import SOURCES from "./public/work/sources.json";

/**
 * Every photograph on the site goes through here.
 *
 * There is no server-side optimizer on Workers, so resizing and re-encoding
 * are done by Cloudflare Image Transformations, addressed as a path prefix on
 * the zone: `/cdn-cgi/image/<options>/<source>`.
 *
 * `width` picks the size, so each `srcSet` candidate is its own file.
 * `format=auto` sends AVIF or WebP to browsers that accept them,
 * which is typically 30-50% off the JPEG at the same quality and the single
 * largest speed win available here.
 *
 * Known limits, each of which looks like a bug if you meet it unprepared:
 *
 *   - `/cdn-cgi/image/` exists only on a Cloudflare **zone**. On
 *     `*.workers.dev` these URLs 404, so a branch preview asks the live zone
 *     instead (`ORIGIN` below). A photograph that exists only on the branch
 *     404s there and `components/site/image-fallback.tsx` shows the original. One
 *     replaced in place on a branch shows the live copy on its preview.
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

/**
 * Where the resizer is asked. Empty on the live site: the zone answers
 * `/cdn-cgi/image/` on its own origin. `https://juliangigola.com` on a
 * branch preview (`next.config.ts` sets it from Workers Builds' branch), so
 * a preview decodes the same sized pictures live does and not the 2500px
 * originals.
 */
const ORIGIN = process.env.NEXT_PUBLIC_IMAGE_CDN_ORIGIN ?? "";

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
  const w = widths.find((candidate) => candidate >= width);
  if (w !== undefined) return src.replace(/\.jpg$/i, `-w${w}.jpg`);
  /* Wider than the widest copy. A hero has nothing bigger and takes its
     widest; a cover is the same picture as a full-size frame
     (`sources.json`, written by `make-cards`), so it takes that frame at
     its 2500px; a scrub frame is its own master. The 1080 copy in a
     2700px slot is a browser upscale and pixelates on a 4K screen. */
  if (m) return src.replace(/\.jpg$/i, `-w${widths[widths.length - 1]}.jpg`);
  return (SOURCES as Record<string, string>)[src] ?? src;
}

/**
 * The two hosts whose stills the video pages draw.
 *
 * A provider thumbnail is somebody else's picture, but it is still a
 * 1280x720 JPEG painted into a tile 340px wide: 165kB where 44 says the same
 * thing. The resizer accepts a whole remote URL as its source, so the ladder
 * that sizes the archive sizes these too, and `format=auto` reaches them as
 * well. Nothing else absolute is touched.
 */
const POSTER_HOSTS = /^https:\/\/i\.(?:ytimg|vimeocdn)\.com\//;

/**
 * The plain file a resized address stands for, or null when `url` is not one.
 * A picture of ours comes back as `/<path>`; a provider still comes back as
 * its own `https://` URL, never glued onto this host as `/https://...`, which
 * 404s. A slash a proxy merged (`https:/`) is put back.
 */
export function plainSrc(url: string): string | null {
  const rest = /\/cdn-cgi\/image\/[^/]+\/(.+)$/.exec(url)?.[1];
  if (!rest) return null;
  return /^https?:\//.test(rest) ? rest.replace(/^(https?:)\/+/, "$1//") : `/${rest}`;
}

export default function cloudflareImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  const options = [
    `width=${width}`,
    // 78 for every picture that is looked at rather than inspected: a
    // step under the harvester's 82 that does not show at 1:1. The
    // viewer's zoomable copy asks for 82 (next.config.ts, `qualities`).
    `quality=${quality ?? 78}`,
    "format=auto",
  ];

  // An absolute URL is somebody else's. A provider's still is sized anyway;
  // anything else is already complete.
  if (!src.startsWith("/")) {
    return CDN && POSTER_HOSTS.test(src)
      ? `${ORIGIN}/cdn-cgi/image/${options.join(",")}/${src}`
      : src;
  }

  // The sized copy when there is one, with or without the resizer. The
  // resizer never upscales and each `cover.jpg` is a 600px harvest, so it
  // gets the larger copy and only ever scales down.
  const source = sizedHero(src, width) ?? src;

  if (!CDN) return source;

  // The source goes in without its leading slash: the format is
  // `/cdn-cgi/image/<options>/<path>`, and a second slash in the path is a
  // different URL — a different cache key and a different counted
  // transformation for the same picture.
  return `${ORIGIN}/cdn-cgi/image/${options.join(",")}/${source.replace(/^\//, "")}`;
}
