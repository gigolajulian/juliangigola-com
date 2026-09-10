import type { NextConfig } from "next";
import { PROJECTS, CATEGORIES } from "./lib/work-data";

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
 * Old category pages. They land on the work index rather than a filtered
 * view — the filter row is the first thing on that page, and every project is
 * already there, so nobody arrives at an empty screen.
 */
const categoryRedirects = CATEGORIES.map((c) => ({
  source: `/${c.slug}`,
  destination: c.section === "SESSIONS" ? "/sessions" : "/work",
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
