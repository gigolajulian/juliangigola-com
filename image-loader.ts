/**
 * Image loader for the static-export preview.
 *
 * GitHub Project Pages serve from `/<repo>`, not the domain root, so every
 * absolute path needs that prefix. Next prepends `basePath` to its own
 * assets and to links, but **not** to the `src` of a `next/image` — with the
 * optimizer off, the src is emitted verbatim. Left alone, every photograph on
 * the site 404s on the deployed preview while working perfectly in dev, which
 * is the worst kind of bug to ship.
 *
 * A custom loader is the fix rather than prefixing at each call site: there is
 * one path into `next/image` for the whole app, and this is it. It also
 * satisfies `output: "export"`, which otherwise demands `unoptimized`.
 *
 * The `width` argument is deliberately ignored. There is no server to resize
 * anything, and the harvester has already capped every frame at 1600px, so
 * each srcSet candidate resolves to the same file. The browser picks one and
 * the markup is a little redundant — the alternative is no images at all.
 */
export default function staticImageLoader({ src }: { src: string; width: number }): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  // Only root-relative paths belong to us. A data: URI or an absolute URL is
  // already complete, and prefixing one would break it.
  if (!src.startsWith("/")) return src;

  // Guard against double-prefixing if a caller has already resolved the path.
  if (base && src.startsWith(base + "/")) return src;

  return base + src;
}
