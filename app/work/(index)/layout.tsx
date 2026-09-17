import { filmCount } from "@/lib/videos";
import type * as React from "react";
import { WorkShell, type Head, type PassPic } from "@/components/work-shell";
import {
  COMMISSIONS,
  COVER_ART,
  WORK_CATEGORY_LINKS,
  projectsIn,
  isDisciplineGallery,
} from "@/lib/work";
import { COVER_RELEASES } from "@/lib/cover-art-data";
import { CONTENT } from "@/lib/content";

/**
 * One frame for the work index, its category pages and the video page:
 * the head and the chip row live here and persist across a filter click,
 * so only the strip under them changes. See `components/work-shell.tsx`.
 *
 * The title and the count for every filter are worked out here, once, and
 * handed down: the shell reads the route to pick one.
 */
const HEADS: Record<string, Head> = {
  all: {
    title: "Work",
    aside: `${COMMISSIONS.length} projects`,
    count: COMMISSIONS.length,
  },
  video: {
    title: "Motion",
    aside: `${filmCount(CONTENT.videos)} films`,
    count: filmCount(CONTENT.videos),
  },
};

for (const c of WORK_CATEGORY_LINKS) {
  if (c.slug === "video") continue;
  const gallery = projectsIn(c.slug).find(isDisciplineGallery);
  const isCoverArt = gallery?.slug === COVER_ART?.slug;
  const count = gallery
    ? isCoverArt
      ? COVER_RELEASES.length
      : gallery.images.length
    : projectsIn(c.slug).length;
  HEADS[c.slug] = {
    title: c.name,
    aside: gallery
      ? `${count} ${isCoverArt ? "releases" : "frames"}`
      : `${count} ${count === 1 ? "project" : "projects"}`,
    // The same number the head says, so the chip and the title it opens
    // can never disagree.
    count,
  };
}

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

export default function WorkIndexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkShell heads={HEADS} categories={WORK_CATEGORY_LINKS} passes={PASSES}>
      {children}
    </WorkShell>
  );
}
