import { filmCount } from "@/lib/videos";
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
  markFor,
  PRESS,
  projectsIn,
} from "@/lib/work";
import { SoleMark } from "@/components/client-marks";
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
/* The eight clients with a mark on file, rendered once and handed to the
   strip as nodes: the panel shows the one the cover in the middle names.
   A map and not a lookup function, because this is a server component and
   a function cannot cross into the client one. */
const MARKS = Object.fromEntries(
  PRESS.map((c) => [c.slug, <SoleMark key={c.slug} client={c} />]),
);

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
          count={`${filmCount(CONTENT.videos)} films`}
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
            // The credit is already the count here; saying it twice on one
            // plate is how "40 frames / 40 frames" happens.
            frames: undefined,
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
        <CoverCell
          key={p.slug}
          /* No frame count on the All view. Julian: it reads on a
             discipline, where you are looking at one kind of work and the
             size of each project is the thing that distinguishes them, and
             it is noise across fifty-eight covers of everything. */
          row={{ ...indexRow(p), frames: undefined }}
          i={i++}
          mark={markFor(p.slug)?.slug}
          eager={i < 4}
        />,
      );
    }
  }

  cells.push(
    <EnquiryCell
      key="enquire"
      title="Have a shoot in mind?"
      body="Tell me what it is for and when, and I'll come back with an approach and a quote."
      type="editorial"
      secondary={{ href: "/studio", label: "How a commission runs" }}
      next={STUDIO}
    />,
  );

  return (
    <Strip
      label={`All work: ${COMMISSIONS.length} projects, left and right`}
      next={STUDIO}
      marks={MARKS}
      className="mt-4 flex-1"
    >
      {cells}
    </Strip>
  );
}
