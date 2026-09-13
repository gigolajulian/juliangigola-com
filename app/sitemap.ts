import type { MetadataRoute } from "next";
import { PROJECTS, WORK_CATEGORY_LINKS } from "@/lib/work";

const SITE = "https://www.juliangigola.com";

// Required by `output: "export"`, which will not infer that a metadata route
// is static. This route has no request-time input, so it always was.
export const dynamic = "force-static";

/**
 * Every project page is listed, including the ones the nav does not link —
 * they are real pages with real work on them, and leaving them out of the
 * sitemap is how the older projects quietly stop being findable.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Listed explicitly, so /admin cannot drift into the sitemap by being a
  // route — it is unlisted on purpose.
  const pages = ["", "/work", "/sessions", "/studio", "/contact"].map(
    (path) => ({
      url: `${SITE}${path}`,
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
    (c) => c.href.startsWith("/work/category/") || c.href === "/work/video",
  ).map((c) => ({
    url: `${SITE}${c.href}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const projects = PROJECTS.map((p) => ({
    url: `${SITE}/work/${p.slug}`,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [...pages, ...categories, ...projects];
}
