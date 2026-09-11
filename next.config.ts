import type { NextConfig } from "next";
// `work`, not `work-data`. The generated manifest is every project the old
// site ever had; `work.ts` is the set actually published, with hidden ones
// filtered out. Redirecting from a legacy URL to a page that is no longer
// built sends a visitor 308 → 404, which is worse than the plain 404 they
// would have got, because it looks like the site meant to take them there.
import { PROJECTS, CATEGORIES, categoryHref } from "./lib/work";

/**
 * The old site published every project at the site root — `/wired-magazine`,
 * `/dystopia`, `/sago`. Those URLs are in Instagram bios, in email threads,
 * and in Google's index, so all of them have to keep working.
 *
 * Generated from the manifest rather than typed out, so a project added or
 * renamed later cannot fall out of the list.
 */
const projectRedirects = PROJECTS.map((p) => ({
  source: `/${p.slug}`,
  destination: `/work/${p.slug}`,
  permanent: true,
}));

/**
 * Old category pages. Each one lands on that discipline's own page now, so an
 * indexed `/editorial` arrives at the editorial work rather than at seventy
 * projects with a filter still to apply. `categoryHref` handles the two edge
 * cases — a category that is itself one gallery, and one with no work yet.
 */
const categoryRedirects = CATEGORIES.map((c) => ({
  source: `/${c.slug}`,
  destination: c.section === "SESSIONS" ? "/sessions" : categoryHref(c.slug),
  permanent: true,
}));

/** Pages that moved or were retired. */
const pageRedirects = [
  { source: "/about", destination: "/studio", permanent: true },
  // /rates never got written — it still served the Format demo's biography.
  // Sessions is where a rate question actually gets answered now.
  { source: "/rates", destination: "/sessions", permanent: true },
  { source: "/links", destination: "/contact", permanent: true },
  // There was a cart in the header but nothing behind it.
  { source: "/store", destination: "/", permanent: true },
];

const nextConfig: NextConfig = {
  // Hides the floating dev badge that sits over the bottom-left corner of
  // every page while `next dev` is running. It never shipped to production,
  // but it lands exactly where the masthead and the numbered index are, which
  // makes it impossible to judge the cover honestly.
  //
  // Compile and runtime errors are still surfaced — this only removes the
  // idle indicator, not the error overlay.
  devIndicators: false,

  /**
   * Photographs are resized and re-encoded by Cloudflare, not by Next.
   *
   * The site runs on Workers, where Next's own optimizer is not available —
   * and would be the wrong tool anyway, because the archive is not served
   * from this origin. It lives in R2. The loader rewrites every frame onto
   * Cloudflare Image Transformations, which is what finally makes the `sizes`
   * props in the components mean something: under the old static export the
   * loader ignored `width` entirely and every device downloaded the same
   * 1600px file. See `image-loader.ts`.
   */
  images: { loader: "custom", loaderFile: "./image-loader.ts" },

  async redirects() {
    // Project slugs win over category slugs where a name is used for both.
    const seen = new Set<string>();
    return [...pageRedirects, ...categoryRedirects, ...projectRedirects].filter((r) => {
      if (seen.has(r.source)) return false;
      seen.add(r.source);
      return true;
    });
  },
};

export default nextConfig;
