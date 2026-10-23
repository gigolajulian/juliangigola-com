import type { Metadata } from "next";
import { V3Work, type WorkItem } from "@/components/v3/work";
import { PROJECTS, categoryLabel } from "@/lib/work";

export const metadata: Metadata = {
  title: "Photography Portfolio, San Francisco Bay Area",
  description:
    "Fashion editorials, brand campaigns, portraits, musician press photos, cover art and music videos by Julian Gigola, photographer in the San Francisco Bay Area.",
  alternates: { canonical: "/portfolio" },
};

/* Best first: the vectorscope's DOPE list (`components/vectorscope.tsx`),
   then the site's running order. */
const DOPE = ["entangled", "vendetta", "lustro", "cyber1a", "channel-orange", "obscura", "true-grit", "cyberscape", "paranoia", "solace", "mirage", "analogue-dreams", "hua", "info-overload", "torteline", "sara", "vesper", "transmutate", "kala-x-sharks", "liminal", "l3na"];
const rank = (slug: string) => {
  const i = DOPE.indexOf(slug);
  return i < 0 ? DOPE.length : i;
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
