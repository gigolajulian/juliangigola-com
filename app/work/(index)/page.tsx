import { filmCount, posterFor, REEL, type Video } from "@/lib/videos";
import type { Metadata } from "next";
import { WorkStrip } from "@/components/work-strip";
import { CoverCell } from "@/components/cover-cell";
import { FilmCell, FrameCell, GroupCell } from "@/components/work-cells";
import { EnquiryCell } from "@/components/enquiry-cell";
import {
  COMMISSIONS,
  COVER_ART,
  WORK_CATEGORY_LINKS,
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
import type { Frame } from "@/lib/work-types";

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
  /* Every gallery frame on the page, in the order they are laid out. A
     press on one opens the viewer at its place in here (`work-strip.tsx`);
     the covers are links to their discipline and are not in it. */
  const viewer: Frame[] = [];
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
      /* Julian: Motion should show up as is. It stood as one cell saying
         how many films there were, in a row where every other discipline
         shows its work. So the reel and then the films run out behind
         the name, each a poster at the strip's height, the way Event
         coverage runs out its frames. They open the films page rather
         than a viewer - a film is not a frame, and the page is where it
         plays. */
      const films: (Video | typeof REEL)[] = [REEL, ...CONTENT.videos];
      for (const [k, film] of films.entries()) {
        cells.push(
          <FilmCell
            key={`film-${"id" in film ? film.id : "reel"}`}
            title={film.title}
            poster={"id" in film ? posterFor(film) : film.poster}
            href={c.href}
            i={i++}
            eager={k === 0}
          />,
        );
      }
      continue;
    }

    const gallery = projectsIn(c.slug).find(isDisciplineGallery);
    if (gallery) {
      /* A discipline Julian shoots straight onto the page opens the way
         every other discipline opens: on its name. It used to open on one
         of its own photographs with the name of the discipline written
         across the plate, which read as a project called Event Coverage
         sitting in a row of projects. The words are the divider and the
         frames run out behind them. Julian asked.

         Cover art is in this now too. It stood as a single sleeve for
         twenty four releases; it shows them. Front faces here, which is
         what a rack shows — the backs are on its own page, where a sleeve
         turns over under the pointer. */
      const isCoverArt = gallery.slug === COVER_ART?.slug;
      const frames = isCoverArt
        ? COVER_RELEASES.map((r) => r.frames[0])
        : gallery.images;
      cells.push(
        <GroupCell
          key={c.slug}
          name={c.name}
          count={`${frames.length} ${isCoverArt ? "releases" : "frames"}`}
          href={c.href}
          hash={c.slug}
          i={i++}
          cta={isCoverArt ? "See the covers" : "See them all"}
        />,
      );
      for (const frame of frames) {
        cells.push(
          <FrameCell
            key={frame.src}
            frame={frame}
            n={viewer.push(frame) - 1}
            name={c.name}
            i={i++}
          />,
        );
      }
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
      tick={false}
      secondary={{ href: "/studio", label: "How a commission runs" }}
      /* Julian: the ask is a page of its own here, not a 40rem cell with
         the last cover still beside it, and the archive does not lead on
         to the studio. A sequence of projects ends where the projects
         end; being carried onto another page for scrolling one notch too
         far is a surprise, and the way to the studio is the button under
         the ask and the word in the header. */
      className="sm:w-[100vw] sm:px-[10vw]"
    />,
  );

  return (
    <WorkStrip
      label={`All work: ${COMMISSIONS.length} projects, left and right`}
      marks={MARKS}
      frames={viewer}
      className="mt-4 max-sm:mt-2 short:mt-2 flex-1"
    >
      {cells}
    </WorkStrip>
  );
}
