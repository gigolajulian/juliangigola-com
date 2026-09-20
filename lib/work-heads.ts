import { filmCount } from "@/lib/videos";
import {
  COMMISSIONS,
  COVER_ART,
  WORK_CATEGORY_LINKS,
  projectsIn,
  isDisciplineGallery,
} from "@/lib/work";
import { COVER_RELEASES } from "@/lib/cover-art-data";
import { CONTENT } from "@/lib/content";

/** What a filter is called and how much is behind it. */
export type Head = {
  title: string;
  /** How many things are behind this filter, for the chip. */
  count: number;
};

/**
 * The title and the count for every filter, worked out once.
 *
 * It used to live in the work index's own layout, which was the right
 * place until the filters became a drawer. A drawer has to sit outside
 * `main` — it is one of the things `main` slides out from under — so it is
 * mounted in the root layout, which is nowhere near the work route. Both
 * read it from here rather than counting the archive twice.
 */
export const WORK_HEADS: Record<string, Head> = {
  all: {
    title: "Work",
    count: COMMISSIONS.length,
  },
  video: {
    title: "Motion",
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
  WORK_HEADS[c.slug] = {
    title: c.name,
    // The same number the head says, so the chip and the title it opens
    // can never disagree.
    count,
  };
}
