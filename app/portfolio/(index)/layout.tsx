import type * as React from "react";
import { WorkShell, type PassPic } from "@/components/work-shell";
import {
  COMMISSIONS,
  WORK_CATEGORY_LINKS,
  projectsIn,
  isDisciplineGallery,
} from "@/lib/work";
import { WORK_HEADS } from "@/lib/work-heads";
import { WORK_ROWS } from "@/lib/work-rows";
import { CONTENT } from "@/lib/content";

/**
 * One frame for the work index, its category pages and the video page:
 * the head and the chip row live here and persist across a filter click,
 * so only the strip under them changes. See `components/work-shell.tsx`.
 *
 * The titles and the counts come from `lib/work-heads.ts`: below `lg` the
 * filters are a drawer mounted in the root layout, which needs the same
 * numbers and is nowhere near this route.
 */
/* Four pictures per filter, for the lane that passes them by when a chip
   is pressed (`work-shell.tsx`): the covers of a discipline's first
   projects, the first frames of a discipline that is one gallery, the
   posters of the first films. Never a whole project object. */
const PASS_COUNT = 4;
const pic = (f: { src: string; width: number; height: number; color?: string }): PassPic => ({
  src: f.src,
  width: f.width,
  height: f.height,
  color: f.color ?? "transparent",
});
const PASSES: Record<string, PassPic[]> = {
  all: COMMISSIONS.slice(0, PASS_COUNT).map((p) => pic(p.cover)),
  video: CONTENT.videos
    .slice(0, PASS_COUNT)
    .flatMap((v) => (v.poster ? [{ src: v.poster, width: 16, height: 9, color: "#111" }] : [])),
};
for (const c of WORK_CATEGORY_LINKS) {
  if (c.slug === "video") continue;
  const gallery = projectsIn(c.slug).find(isDisciplineGallery);
  PASSES[c.slug] = gallery
    ? gallery.images.slice(0, PASS_COUNT).map(pic)
    : projectsIn(c.slug)
        .slice(0, PASS_COUNT)
        .map((p) => pic(p.cover));
}

/* What the colour panel needs of each line of the index: which samples
   are its, which link on the page is it, and what to call it. */
const SCOPE = WORK_ROWS.map(({ slug, href, name }) => ({ slug, href, name }));

export default function WorkIndexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkShell
      heads={WORK_HEADS}
      categories={WORK_CATEGORY_LINKS}
      passes={PASSES}
      scope={SCOPE}
    >
      {children}
    </WorkShell>
  );
}
