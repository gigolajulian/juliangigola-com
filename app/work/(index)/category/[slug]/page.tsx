import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Strip } from "@/components/strip";
import { TitleCell } from "@/components/strip-page";
import { CoverCell } from "@/components/cover-cell";
import { ProjectStrip } from "@/components/project-strip";
import { CoverArtGallery } from "@/components/cover-art-gallery";
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_LINKS,
  COMMISSIONS,
  COVER_ART,
  projectsIn,
  categoryHref,
  categoryLabel,
  indexRow,
  isDisciplineGallery,
  markFor,
} from "@/lib/work";
import { WorkSheet } from "@/components/work-sheet";
import { WORK_ROWS } from "@/lib/work-rows";
import type { ListRow } from "@/components/work-list";
import type { Frame } from "@/lib/work-types";
import { COVER_RELEASES } from "@/lib/cover-art-data";

/* ── a discipline ─────────────────────────────────────────────────
 * One page per category, so a discipline is a place rather than a filter
 * somebody has to apply after landing on all seventy projects at once.
 *
 * That is what the cover's index links to, it is what the old site's
 * `/editorial` and `/campaigns` URLs redirect to, and it is what an art
 * director can be sent directly: "here is the editorial work" is a link,
 * not an instruction.
 *
 * A static segment, `/work/category/…`, rather than sharing `/work/[slug]`
 * with the projects: five categories are published under the same slug as a
 * project (COVERART, WEDDINGS), and one route serving both would have to pick
 * a winner and silently shadow the loser.
 *
 * The head and the chip row are the `(index)` layout's; this is the strip
 * under them, one discipline's chapter of the whole. Past its last cover
 * the wheel leads to the next discipline along the chip row, and back off
 * its first to the one before.
 * ─────────────────────────────────────────────────────────────── */


/**
 * Only categories that have something to show.
 *
 * An empty one has nothing to put on a page: `categoryHref` sends it back to
 * `/work`, so it is never linked here. A category that is itself a single
 * gallery *is* listed: it renders its frames under the filter row where the
 * project list would be, which is what Julian asked for. Click Automotive
 * and the cars load right there.
 */
const LISTED = WORK_CATEGORIES.filter(
  (c) => categoryHref(c.slug) === `/work/category/${c.slug}`,
);

/** The discipline after this one along the chip row. The chain runs once
    and does not wrap, and past the last one there is nothing: the archive
    ending is not a request to be taken to the about page. */
const after = (slug: string) => {
  const at = WORK_CATEGORY_LINKS.findIndex((c) => c.slug === slug);
  const next = at === -1 ? undefined : WORK_CATEGORY_LINKS[at + 1];
  return next ? { href: next.href, name: next.name } : undefined;
};

/** And the one before it, with All work before the first. Julian: pushing
    back off the start of a filter should lead to the filter before it, the
    way pushing off the end leads to the one after. The chip row read in
    both directions, so a sequence you walked into can be walked back out
    of without going to the row and picking. */
const before = (slug: string) => {
  const at = WORK_CATEGORY_LINKS.findIndex((c) => c.slug === slug);
  if (at < 0) return undefined;
  const prev = WORK_CATEGORY_LINKS[at - 1];
  return prev
    ? { href: prev.href, name: prev.name }
    : { href: "/work", name: "All work" };
};

export function generateStaticParams() {
  return LISTED.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata(
  props: PageProps<"/work/category/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const category = LISTED.find((c) => c.slug === slug);
  if (!category) return {};

  const name = categoryLabel(category);
  const gallery = projectsIn(slug).find(isDisciplineGallery);
  const count = gallery ? gallery.images.length : projectsIn(slug).length;

  return {
    title: name,
    description: gallery
      ? `${count} ${name.toLowerCase()} frames by Julian Gigola.`
      : `${name}: ${count} ${count === 1 ? "project" : "projects"} by Julian Gigola, with clients and credits.`,
    alternates: { canonical: `/work/category/${slug}` },
  };
}

/* ── the disciplines that are not projects ────────────────────────
 * Event coverage, Automotive and Places are photographs put straight on
 * the page, and Cover art is a rack of sleeves. In the list they are their
 * own contents — a line per frame, a line per release — and not the single
 * line that stands for the whole of them on All. Julian asked.
 *
 * A frame has no page to open, so its line opens the viewer instead:
 * `n` is its place in the frames handed alongside (`work-list.tsx`).
 * ─────────────────────────────────────────────────────────────── */
/* The alt text of these frames is written by the harvester and says
   "Places, frame 3 of 20", which is the number the line already carries.
   A description that says something else is printed instead. */
const COUNTED = /frame \d+ of \d+/i;

const framesList = (frames: Frame[], name: string): ListRow[] =>
  frames.map((f, i) => {
    const said = f.alt?.trim();
    return {
      slug: f.src,
      n: i,
      name: `${name} ${String(i + 1).padStart(2, "0")}`,
      href: "",
      discipline: name,
      credit: said && !COUNTED.test(said) ? said : `Frame ${i + 1}`,
      cover: f,
      find: `${name} ${said ?? ""}`.toLowerCase(),
    };
  });

export default async function CategoryPage(
  props: PageProps<"/work/category/[slug]">,
) {
  const { slug } = await props.params;
  const category = LISTED.find((c) => c.slug === slug);
  if (!category) notFound();

  // Ordered as the full index orders them, so moving between disciplines does
  // not reshuffle work someone has already scrolled past.
  const projects = COMMISSIONS.filter((p) =>
    p.categories.some((c) => c.slug === slug),
  );
  // The discipline that is one gallery rather than a list of projects:
  // Cover art, Automotive, Places, Event coverage. `COMMISSIONS` leaves these
  // out on purpose, so they are looked up on their own.
  const gallery = projectsIn(slug).find(isDisciplineGallery);
  const isCoverArt = gallery?.slug === COVER_ART?.slug;
  const name = categoryLabel(category);
  const next = after(slug);
  const prev = before(slug);
  /* Julian: no ask at the end of a discipline. Eleven filters meant
     eleven copies of the same question, each one standing between the
     last cover of one discipline and the first of the next, which is
     exactly where somebody walking the row does not want to be stopped.
     It is asked once, at the end of the whole archive, and the header
     carries Contact from every screen.
   */

  /* A photographic gallery is a sequence and gets the project strip, which
     ends on the next discipline as a project ends on the next project. On a
     phone it keeps its sideways swipe and needs a height to do it in. */
  if (gallery && !isCoverArt) {
    return (
      <WorkSheet
        rows={WORK_ROWS}
        mine={framesList(gallery.images, name)}
        frames={gallery.images}
        within={name}
      >
        <div className="flex min-h-0 flex-1 flex-col max-sm:h-[75dvh] max-sm:flex-none">
          <ProjectStrip
            project={gallery}
            next={next}
            prev={prev}
            className="mt-4 flex-1"
          />
        </div>
      </WorkSheet>
    );
  }

  /* Cover art is a catalogue and gets its rack, two rows of sleeves along
     the strip, as one cell. */
  if (gallery && isCoverArt) {
    return (
      <WorkSheet
        rows={WORK_ROWS}
        /* A release is a record sleeve with a name and an artist on it,
           and both faces are on the rack behind this list, so a line
           opens the front of it in the viewer. */
        mine={COVER_RELEASES.map((r, i) => ({
          slug: r.frames[0].src,
          n: i,
          name: r.title,
          href: "",
          discipline: name,
          credit: r.artist,
          cover: r.frames[0],
          find: `${r.title} ${r.artist}`.toLowerCase(),
        }))}
        frames={COVER_RELEASES.map((r) => r.frames[0])}
        within={name}
      >
        <Strip
          label={`Cover art: ${COVER_RELEASES.length} releases, left and right`}
          next={next}
          prev={prev}
          className="mt-4 flex-1"
        >
          <TitleCell title={name} hash={slug}>
            <p className="label text-muted-foreground">
              {COVER_RELEASES.length} releases
            </p>
          </TitleCell>
          <div
            data-tick
            data-label={name}
            className="w-full shrink-0 sm:h-full sm:w-auto"
          >
            <CoverArtGallery releases={COVER_RELEASES} rows />
          </div>
        </Strip>
      </WorkSheet>
    );
  }

  return (
    <WorkSheet rows={WORK_ROWS} within={name}>
      <Strip
        label={`${name}: ${projects.length} projects, left and right`}
        next={next}
        prev={prev}
          className="mt-4 flex-1"
      >
        {[
          <TitleCell key="title" title={name} hash={slug}>
            <p className="label text-muted-foreground">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </p>
          </TitleCell>,
          ...projects.map((p, i) => (
            <CoverCell
              key={p.slug}
              row={indexRow(p)}
              i={i}
              mark={markFor(p.slug)?.slug}
              eager={i < 3}
            />
          )),
        ]}
      </Strip>
    </WorkSheet>
  );
}
