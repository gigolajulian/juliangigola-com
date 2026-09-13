import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { WorkIndex } from "@/components/work-index";
import { CallToAction } from "@/components/call-to-action";
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_LINKS,
  COMMISSIONS,
  COVER_ART,
  projectsIn,
  categoryHref,
  categoryLabel,
  enquiryTypeFor,
  isDisciplineGallery,
} from "@/lib/work";
import { COVER_RELEASES } from "@/lib/cover-art-data";
import { Gallery } from "@/components/gallery";
import { CoverArtGallery } from "@/components/cover-art-gallery";

/* ── a discipline ─────────────────────────────────────────────────
 * One page per category, so a discipline is a place rather than a filter
 * somebody has to apply after landing on all seventy projects at once.
 *
 * That is what the cover's index links to, it is what the old site's
 * `/editorial` and `/campaigns` URLs redirect to, and it is what an art
 * director can be sent directly — "here is the editorial work" is a link,
 * not an instruction.
 *
 * A static segment, `/work/category/…`, rather than sharing `/work/[slug]`
 * with the projects: five categories are published under the same slug as a
 * project (COVERART, WEDDINGS), and one route serving both would have to pick
 * a winner and silently shadow the loser.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Only categories that have something to show.
 *
 * An empty one has nothing to put on a page — `categoryHref` sends it back to
 * `/work`, so it is never linked here. A category that is itself a single
 * gallery *is* listed: it renders its frames under the filter row where the
 * project list would be, which is what Julian asked for — click Automotive
 * and the cars load right there.
 */
const LISTED = WORK_CATEGORIES.filter(
  (c) => categoryHref(c.slug) === `/work/category/${c.slug}`,
);

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
      : `${count} commissioned ${name.toLowerCase()} ${
          count === 1 ? "project" : "projects"
        } by Julian Gigola — with clients and credits.`,
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
  // The discipline that is one gallery rather than a list of projects —
  // Cover art, Automotive, Places, Event coverage. `COMMISSIONS` leaves these
  // out on purpose, so they are looked up on their own.
  const gallery = projectsIn(slug).find(isDisciplineGallery);
  const isCoverArt = gallery?.slug === COVER_ART?.slug;
  const name = categoryLabel(category);

  return (
    <>
      <div className="mx-auto w-full max-w-[100rem] px-6 pb-24 pt-28 sm:px-10 sm:pt-36">
        {/* The same head as /work, so a chip click changes the words and
            not the shape of the page. This used to carry the discipline's
            cover frame on the right, the way the cover's index does — Julian
            asked for it to go: somebody who has clicked "Campaigns" already
            knows what they came for, and what they want next is the list.

            `rise` on the block, not the header: the header is new DOM on
            every navigation, so the title arrives with the rows below it. */}
        <header>
          <div className="rise">
            <nav aria-label="Breadcrumb">
              <Link
                href="/work"
                className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
              >
                &larr; All work
              </Link>
            </nav>

            <h1 className="mt-8 title">{name}</h1>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {gallery
                ? `${isCoverArt ? COVER_RELEASES.length : gallery.images.length} ${
                    isCoverArt ? "releases" : "frames"
                  }.`
                : `${projects.length} commissioned ${
                    projects.length === 1 ? "project" : "projects"
                  }.`}
            </p>
          </div>
        </header>

        <WorkIndex
          projects={projects}
          categories={WORK_CATEGORY_LINKS}
          active={slug}
        >
          {/* Under the chips, in place of the list. Cover art is a catalogue
              of 1:1 sleeves and gets its rack; the rest are photographic
              sequences and get the paired-frame spread. */}
          {gallery ? (
            isCoverArt ? (
              <CoverArtGallery releases={COVER_RELEASES} />
            ) : (
              <Gallery project={gallery} />
            )
          ) : undefined}
        </WorkIndex>
      </div>

      <CallToAction
        title={`Commission ${name.toLowerCase()}`}
        body="Send the brief and I'll come back with an approach, a crew, and a quote."
        type={enquiryTypeFor(projects[0] ?? gallery ?? COMMISSIONS[0])}
        secondary={{ href: "/work", label: "See all the work" }}
      />
    </>
  );
}
