import type { Metadata } from "next";
import { Strip } from "@/components/strip";
import { CoverCell } from "@/components/cover-cell";
import { GroupCell } from "@/components/work-cells";
import { EnquiryCell } from "@/components/enquiry-cell";
import {
  COMMISSIONS,
  COVER_ART,
  WORK_CATEGORY_LINKS,
  STUDIO,
  commissionsIn,
  indexRow,
  isDisciplineGallery,
  projectsIn,
} from "@/lib/work";
import { COVER_RELEASES } from "@/lib/cover-art-data";
import { CONTENT } from "@/lib/content";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Commissioned photography: editorial, campaigns, portraits, artist imagery, and film. Selected projects with clients and credits.",
  alternates: { canonical: "/work" },
};

/* ── all the work, as one strip ───────────────────────────────────
 * Discipline by discipline, in the order of the chip row: each opens on
 * its name and runs through its covers, so wheeling along the strip reads
 * the whole archive as chapters, and a chip at the top glides to a
 * chapter's opening. A discipline that is one gallery rather than a list
 * (Cover art, Automotive) is one cover cell standing for the whole of it;
 * the films are a cell of words pointing at their page. It ends on the
 * ask, and past the ask on the studio.
 *
 * The head and the chips are the layout's; this is the sequence.
 * ─────────────────────────────────────────────────────────────── */
export default function WorkPage() {
  /* No title cell. "Work" set large next to "Editorial" set large was two
     titles on one screen arguing about which page you were on; the word is
     in the middle of the head now, where it rises into place as the page
     arrives, and the strip opens on the first discipline. */
  const cells: React.ReactNode[] = [];
  let i = 0;

  for (const c of WORK_CATEGORY_LINKS) {
    if (c.slug === "video") {
      cells.push(
        <GroupCell
          key={c.slug}
          name={c.name}
          count={`${CONTENT.videos.length + 1} films`}
          href={c.href}
          hash={c.slug}
          i={i++}
          cta="See the films"
        />,
      );
      continue;
    }

    const gallery = projectsIn(c.slug).find(isDisciplineGallery);
    if (gallery) {
      const isCoverArt = gallery.slug === COVER_ART?.slug;
      const n = isCoverArt ? COVER_RELEASES.length : gallery.images.length;
      cells.push(
        <CoverCell
          key={c.slug}
          row={{
            ...indexRow(gallery),
            name: c.name,
            credit: `${n} ${isCoverArt ? "releases" : "frames"}`,
          }}
          href={c.href}
          label={c.name}
          hash={c.slug}
          i={i++}
          eager={i < 4}
        />,
      );
      continue;
    }

    const run = commissionsIn(c.slug);
    if (!run.length) continue;
    cells.push(
      <GroupCell
        key={c.slug}
        name={c.name}
        count={`${run.length} ${run.length === 1 ? "project" : "projects"}`}
        href={c.href}
        hash={c.slug}
        i={i++}
      />,
    );
    for (const p of run) {
      cells.push(
        <CoverCell key={p.slug} row={indexRow(p)} i={i++} eager={i < 4} />,
      );
    }
  }

  cells.push(
    <EnquiryCell
      key="enquire"
      title="Commission a shoot"
      body="Tell me what you have in mind and I'll come back with an approach and a quote."
      type="editorial"
      secondary={{ href: "/studio", label: "How a commission runs" }}
      next={STUDIO}
    />,
  );

  return (
    <Strip
      label={`All work: ${COMMISSIONS.length} projects, left and right`}
      next={STUDIO}
      className="mt-4 flex-1"
    >
      {cells}
    </Strip>
  );
}
