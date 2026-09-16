import type * as React from "react";
import { WorkShell, type Head } from "@/components/work-shell";
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
    aside: `${CONTENT.videos.length + 1} films`,
    count: CONTENT.videos.length + 1,
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

export default function WorkIndexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WorkShell heads={HEADS} categories={WORK_CATEGORY_LINKS}>
      {children}
    </WorkShell>
  );
}
