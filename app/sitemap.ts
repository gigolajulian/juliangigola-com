import type { MetadataRoute } from "next";
import { PROJECTS } from "@/lib/work";

const SITE = "https://www.juliangigola.com";

/**
 * Every project page is listed, including the ones the nav does not link —
 * they are real pages with real work on them, and leaving them out of the
 * sitemap is how the older projects quietly stop being findable.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["", "/work", "/sessions", "/studio", "/contact"].map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: "monthly" as const,
    priority: path === "" ? 1 : 0.8,
  }));

  const projects = PROJECTS.map((p) => ({
    url: `${SITE}/work/${p.slug}`,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [...pages, ...projects];
}
