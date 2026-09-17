import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Strip } from "@/components/strip";
import { TitleCell } from "@/components/strip-page";
import { CoverCell } from "@/components/cover-cell";
import { EnquiryCell } from "@/components/enquiry-cell";
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
  enquiryTypeFor,
  indexRow,
  isDisciplineGallery,
  markFor,
  PRESS,
} from "@/lib/work";
import { SoleMark } from "@/components/client-marks";
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
 * under them, one discipline's chapter of the whole. Past its ask the
 * wheel leads to the next discipline along the chip row, and past the
 * last one to the studio.
 * ─────────────────────────────────────────────────────────────── */

/* The eight clients with a mark on file, rendered once and handed to the
   strip as nodes: the panel shows the one the cover in the middle names.
   A map and not a lookup function, because this is a server component and
   a function cannot cross into the client one. */
const MARKS = Object.fromEntries(
  PRESS.map((c) => [c.slug, <SoleMark key={c.slug} client={c} />]),
);

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
    ending is not a request to be taken to the studio. */
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
  return prev ? { href: prev.href, name: prev.name } : { href: "/work", name: "All work" };
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
  const ask = (
    <EnquiryCell
      key="enquire"
      title={`Something in ${name.toLowerCase()}?`}
      body="Tell me what it is for and when, and I'll come back with an approach and a quote."
      type={enquiryTypeFor(projects[0] ?? gallery ?? COMMISSIONS[0])}
      secondary={{ href: "/work", label: "See the work" }}
      next={next}
    />
  );

  /* A photographic gallery is a sequence and gets the project strip, which
     ends on the next discipline as a project ends on the next project. On a
     phone it keeps its sideways swipe and needs a height to do it in. */
  if (gallery && !isCoverArt) {
    return (
      <div className="flex min-h-0 flex-1 flex-col max-sm:h-[75dvh] max-sm:flex-none">
        <ProjectStrip
          project={gallery}
          next={next}
          prev={prev}
          className="mt-4 flex-1"
        />
      </div>
    );
  }

  /* Cover art is a catalogue and gets its rack, two rows of sleeves along
     the strip, as one cell. */
  if (gallery && isCoverArt) {
    return (
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
        {ask}
      </Strip>
    );
  }

  return (
    <Strip
      label={`${name}: ${projects.length} projects, left and right`}
      next={next}
      prev={prev}
      marks={MARKS}
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
        ask,
      ]}
    </Strip>
  );
}
