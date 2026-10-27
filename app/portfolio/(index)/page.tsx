import type { Metadata } from "next";
import { V3Work, type WorkItem } from "@/components/v3/work";
import { CATEGORIES, PROJECTS, categoryLabel } from "@/lib/work";
import ORDER from "@/lib/portfolio-order.json";
import { ogCard } from "@/lib/og";

export const metadata: Metadata = {
  title: "Photography Portfolio, San Francisco Bay Area",
  description:
    "Fashion editorials, brand campaigns, portraits, musician press photos, cover art and music videos by Julian Gigola, photographer in the San Francisco Bay Area.",
  alternates: { canonical: "/portfolio" },
  ...ogCard("portfolio", "Julian Gigola"),
};

/* Julian's order from the Work Order arrange page, then any project it
   doesn't know yet in the site's running order. */
const rank = (slug: string) => {
  const i = ORDER.indexOf(slug);
  return i < 0 ? ORDER.length : i;
};
/* Off the V3 portfolio grid (Julian, 2026-10-23); the project page stays up. */
const HIDDEN = ["realestate"];
const WORK_PROJECTS = PROJECTS.filter((p) => !HIDDEN.includes(p.slug));
const WORK: WorkItem[] = WORK_PROJECTS
  .map((p, i) => [p, i] as const)
  .sort((a, b) => rank(a[0].slug) - rank(b[0].slug) || a[1] - b[1])
  .map(([p]) => ({
    s: p.slug,
    n: p.name,
    d: p.categories.map(categoryLabel),
    c: p.credits.map((c) => (c.handle ? `@${c.handle}` : c.name)).join(" "),
    cover: p.cover.src,
  }));

/* `?d=<slug>` opens with that discipline's chip on (`categoryHref`). */
const CHIP = Object.fromEntries(CATEGORIES.map((c) => [c.slug, categoryLabel(c)]));

/* Julian (2026-10-27): these chips show their gallery's frames in the grid
   instead of its one cover. */
const FRAME_CHIPS = ["automotive", "graduation", "coverart", "events", "headshots", "places", "weddings"];
const FRAMES = Object.fromEntries(
  CATEGORIES.filter((c) => FRAME_CHIPS.includes(c.slug)).map((c) => [
    categoryLabel(c),
    WORK_PROJECTS.filter((p) => p.categories.some((k) => k.slug === c.slug)).flatMap((p) =>
      p.images.map((f) => ({ s: p.slug, src: f.src, alt: f.alt ?? p.name, wide: f.width > f.height * 1.05, sq: Math.abs(f.width / f.height - 1) < 0.02 })),
    ),
  ]),
);

/* JG V3 Portfolio (master v39). The old strip of disciplines is retired;
   its components are left in place, unused. */
export default function WorkPage() {
  return <V3Work work={WORK} chip={CHIP} frames={FRAMES} />;
}
