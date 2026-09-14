import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkIndex } from "@/components/work-index";
import { CallToAction } from "@/components/call-to-action";
import {
  WORK_CATEGORIES,
  COMMISSIONS,
  COVER_ART,
  projectsIn,
  categoryHref,
  categoryLabel,
  enquiryTypeFor,
  indexRow,
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
 * director can be sent directly: "here is the editorial work" is a link,
 * not an instruction.
 *
 * A static segment, `/work/category/…`, rather than sharing `/work/[slug]`
 * with the projects: five categories are published under the same slug as a
 * project (COVERART, WEDDINGS), and one route serving both would have to pick
 * a winner and silently shadow the loser.
 *
 * The head and the chip row are the `(index)` layout's, so a click on a
 * chip changes the list and nothing else.
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
        } by Julian Gigola, with clients and credits.`,
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

  return (
    <>
      <div className="mx-auto w-full max-w-[100rem] px-6 pb-24 sm:px-10">
        {/* Under the chips, in place of the list. Cover art is a catalogue
            of 1:1 sleeves and gets its rack; the other galleries are
            photographic sequences and get the paired-frame spread. */}
        {gallery ? (
          isCoverArt ? (
            <CoverArtGallery releases={COVER_RELEASES} />
          ) : (
            <Gallery project={gallery} />
          )
        ) : (
          <WorkIndex projects={projects.map(indexRow)} />
        )}
      </div>

      <CallToAction
        title={`Commission ${name.toLowerCase()}`}
        body="Tell me what you have in mind and I'll come back with an approach and a quote."
        type={enquiryTypeFor(projects[0] ?? gallery ?? COMMISSIONS[0])}
        secondary={{ href: "/work", label: "See all the work" }}
      />
    </>
  );
}
