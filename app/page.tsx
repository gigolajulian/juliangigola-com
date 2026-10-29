import type { Metadata } from "next";
import { V3Home, type TopWork } from "@/components/v3/home";
import { COMMISSION_TABS } from "@/lib/v3";
import { PROJECTS, categoryLabel } from "@/lib/work";
import ORDER from "@/lib/portfolio-order.json";
import { shareOg } from "@/lib/share";

export const metadata: Metadata = shareOg("Photographer and creative director","Fashion editorial, campaigns and portraits in the San Francisco Bay Area. Available worldwide.");

/* JG V3 homepage (master v39). The old deck (strip, cover float, screens)
   is retired; its components are left in place, unused. */
/* Each Commissions tab's top projects in Julian's portfolio order, as
   /portfolio shows them: nine, or five, the counts that fill the sheet
   (one large and its small ones). Fewer than five and the tab keeps
   linking to /portfolio. */
const rank = (slug: string) => {
  const i = ORDER.indexOf(slug);
  return i < 0 ? ORDER.length : i;
};
const TOP: Record<string, TopWork[]> = Object.fromEntries(
  COMMISSION_TABS.flatMap(([, href]) => {
    const d = new URLSearchParams(href.split("?")[1]).get("d");
    if (!d) return [];
    const list = PROJECTS.filter((p) => p.slug !== "realestate" && p.categories.some((c) => c.slug === d))
      .sort((a, b) => rank(a.slug) - rank(b.slug))
      .map((p) => ({ s: p.slug, n: p.name, src: p.cover.src, meta: categoryLabel(p.categories.find((c) => c.slug === d)!) }));
    const fit = list.length >= 9 ? 9 : list.length >= 5 ? 5 : 0;
    return fit ? [[d, list.slice(0, fit)]] : [];
  }),
);

export default function Home() {
  return <V3Home top={TOP} />;
}
