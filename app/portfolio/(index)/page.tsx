import type { Metadata } from "next";
import { V3Work, type WorkItem } from "@/components/v3/work";
import { PROJECTS, categoryLabel } from "@/lib/work";
import ORDER from "@/lib/portfolio-order.json";

export const metadata: Metadata = {
  title: "Photography Portfolio, San Francisco Bay Area",
  description:
    "Fashion editorials, brand campaigns, portraits, musician press photos, cover art and music videos by Julian Gigola, photographer in the San Francisco Bay Area.",
  alternates: { canonical: "/portfolio" },
};

/* Julian's order from the Work Order arrange page, then any project it
   doesn't know yet in the site's running order. */
const rank = (slug: string) => {
  const i = ORDER.indexOf(slug);
  return i < 0 ? ORDER.length : i;
};
const WORK: WorkItem[] = PROJECTS.map((p, i) => [p, i] as const)
  .sort((a, b) => rank(a[0].slug) - rank(b[0].slug) || a[1] - b[1])
  .map(([p]) => ({
    s: p.slug,
    n: p.name,
    d: p.categories.map(categoryLabel),
    c: p.credits.map((c) => (c.handle ? `@${c.handle}` : c.name)).join(" "),
    cover: p.cover.src,
  }));

/* JG V3 Portfolio (master v39). The old strip of disciplines is retired;
   its components are left in place, unused. */
export default function WorkPage() {
  return <V3Work work={WORK} />;
}
