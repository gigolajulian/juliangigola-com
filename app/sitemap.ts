import type { MetadataRoute } from "next";
import {
  PROJECTS,
  WORK_CATEGORY_LINKS,
  LISTINGS,
  COMMISSIONS,
  COVER_ART,
  FEATURED,
  DISCIPLINE_TILES,
  commissionsIn,
  projectsIn,
  isDisciplineGallery,
} from "@/lib/work";
import type { Frame } from "@/lib/work-types";
import { COVER_RELEASES } from "@/lib/cover-art-data";
import DATES from "@/lib/sitemap-dates.json";
import { BOOKING_PAGES, bookingHref } from "@/lib/booking";

const SITE = "https://juliangigola.com";

// Required by `output: "export"`, which will not infer that a metadata route
// is static. This route has no request-time input, so it always was.
export const dynamic = "force-static";

/* ── lastmod and images ───────────────────────────────────────────
 * Julian: "add lastmod dates and images to the sitemap".
 *
 * A page's date is when the newest of the photographs it shows last
 * changed in git: the photographs are what changes on these pages, and a
 * date that moved with every build would be one Google stops believing.
 * The dates are read from `lib/sitemap-dates.json`, which
 * `scripts/sitemap-dates.mjs` writes from the history, because the build
 * that ships runs on a shallow clone that has none. A page with no date
 * there (a project added since the file was last written) goes out
 * without a `<lastmod>` rather than with a guessed one.
 *
 * Its images are those photographs, as the originals on this domain, once
 * each and no more than the 1,000 Google reads per page.
 * ─────────────────────────────────────────────────────────────── */

/** When a picture last changed: its project folder's date for the archive
    (`/work/<slug>/…`), its own for anything else. */
const changed = (src: string): number => {
  const parts = src.split("/"); // "", work, <slug>, <file>
  const key = parts[1] === "work" && parts.length > 3 ? `/work/${parts[2]}` : src;
  const date = (DATES as Record<string, string>)[key];
  return date ? Date.parse(date) : NaN;
};

/** A page's `images` and `lastModified`, from the frames it shows. */
const showing = (frames: Frame[]) => {
  const srcs = [...new Set(frames.map((f) => f.src))].slice(0, 1000);
  const newest = Math.max(...srcs.map(changed).filter(Number.isFinite));
  return {
    images: srcs.map((src) => `${SITE}${encodeURI(src)}`),
    ...(Number.isFinite(newest) ? { lastModified: new Date(newest) } : {}),
  };
};

/** What a discipline shows: its one gallery's frames, or its projects'
    covers. Cover art's rack shows the front of each sleeve. */
const galleryOf = (slug: string) => projectsIn(slug).find(isDisciplineGallery);
const galleryFrames = (gallery: NonNullable<ReturnType<typeof galleryOf>>) =>
  gallery.slug === COVER_ART?.slug
    ? COVER_RELEASES.map((r) => r.frames[0])
    : gallery.images;

/**
 * Every project page is listed, including the ones the nav does not link —
 * they are real pages with real work on them, and leaving them out of the
 * sitemap is how the older projects quietly stop being findable.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Listed explicitly, so /admin cannot drift into the sitemap by being a
  // route — it is unlisted on purpose.
  //
  // The homepage shows the featured work, the discipline tiles and, on its
  // drifting wall, every project's cover. /portfolio runs each discipline
  // out in turn: a gallery's frames, or its commissions' covers. /legal has
  // no pictures; its date is its sources' own.
  const shownOn: Record<string, Frame[]> = {
    "": [...FEATURED, ...DISCIPLINE_TILES, ...PROJECTS].map((p) => p.cover),
    "/portfolio": WORK_CATEGORY_LINKS.flatMap((c) => {
      const gallery = galleryOf(c.slug);
      return gallery
        ? galleryFrames(gallery)
        : commissionsIn(c.slug).map((p) => p.cover);
    }),
  };
  const pages = ["", "/portfolio", "/legal"].map(
    (path) => ({
      url: `${SITE}${path}`,
      ...(path === "/legal"
        ? { lastModified: new Date(DATES.legal) }
        : showing(shownOn[path])),
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.8,
    }),
  );

  // The discipline pages. They sit above individual projects in priority:
  // they are the pages a search for "bay area editorial photographer" should
  // land on, and each one is a real destination rather than a filtered view.
  const categories = WORK_CATEGORY_LINKS.filter(
    // The listings, plus Video — whose page is the work itself rather than a
    // listing of projects, and which is a destination in exactly the same way
    // ("bay area music video director" is the search it answers). The other
    // one-gallery disciplines arrive below as projects, because that is what
    // they are.
    (c) => c.filter,
  ).map((c) => {
    const gallery = galleryOf(c.slug);
    return {
      url: `${SITE}${c.href}`,
      /* Video's page is films, whose posters are on YouTube and Vimeo and
         whose list is in `content/site.json` among everything else there,
         so it has neither pictures of this site's nor a date to give. */
      ...(c.slug === "video"
        ? {}
        : showing(
            gallery
              ? galleryFrames(gallery)
              : COMMISSIONS.filter((p) =>
                  p.categories.some((k) => k.slug === c.slug),
                ).map((p) => p.cover),
          )),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    };
  });

  // Once each: where a discipline shares its slug with its one gallery
  // (Automotive, Events, Places), the address is the discipline's above.
  const listed = new Set(LISTINGS.map((c) => c.slug));
  const projects = PROJECTS.filter((p) => !listed.has(p.slug)).map((p) => ({
    url: `${SITE}/portfolio/${p.slug}`,
    ...showing([p.cover, ...p.images]),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  /* The booking pages: above the disciplines, because a search that
     lands on one is somebody pricing a shoot (`lib/booking.ts`). Their
     pictures are the ones they show. */
  const booking = BOOKING_PAGES.map((p) => ({
    url: `${SITE}${bookingHref(p)}`,
    ...showing(p.tiles.slice(0, 7).map((t) => t.frame)),
    changeFrequency: "monthly" as const,
    priority: 0.9,
  }));

  return [...pages, ...booking, ...categories, ...projects];
}
