import { PROJECTS } from "@/lib/work";
import ORDER from "@/lib/portfolio-order.json";
import { HERO } from "@/lib/v3";

/* The splash's run of photographs: the first covers of the portfolio, in
   Julian's order (Work Order arrange page), so reordering the portfolio
   reorders the splash. The hero it ends on is left out of the run, in
   either theme, so it never shows twice. Read on the server (`layout.tsx`)
   so the project list stays out of the page's scripts. */
const COUNT = 8;
const HIDDEN = ["realestate"]; // off the portfolio grid, as on `/portfolio`
const ENDS = new Set([HERO[0].d.src, HERO[0].l.src]);

export const SPLASH_RUN: string[] = ORDER.map((slug) => PROJECTS.find((p) => p.slug === slug))
  .filter((p) => p && !HIDDEN.includes(p.slug) && !ENDS.has(p.cover.src))
  .slice(0, COUNT)
  .map((p) => p!.cover.src);
