import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { WorkIndex } from "@/components/work-index";
import { CallToAction } from "@/components/call-to-action";
import {
  WORK_CATEGORIES,
  WORK_CATEGORY_LINKS,
  COMMISSIONS,
  projectsIn,
  categoryHref,
  categoryLabel,
  categoryFrame,
  enquiryTypeFor,
} from "@/lib/work";

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
 * Only categories that have a listing to show.
 *
 * A category that is itself a single gallery is its own project page, and an
 * empty one has nothing to put on a page — `categoryHref` sends both
 * somewhere real, so neither is ever linked here.
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
  const count = projectsIn(slug).length;

  return {
    title: name,
    description: `${count} commissioned ${name.toLowerCase()} ${
      count === 1 ? "project" : "projects"
    } by Julian Gigola — with clients and credits.`,
    alternates: { canonical: `/work/category/${slug}` },
  };
}

export default async function CategoryPage(props: PageProps<"/work/category/[slug]">) {
  const { slug } = await props.params;
  const category = LISTED.find((c) => c.slug === slug);
  if (!category) notFound();

  // Ordered as the full index orders them, so moving between disciplines does
  // not reshuffle work someone has already scrolled past.
  const projects = COMMISSIONS.filter((p) => p.categories.some((c) => c.slug === slug));
  const name = categoryLabel(category);
  const frame = categoryFrame(slug);

  return (
    <>
      <div className="mx-auto w-full max-w-[100rem] px-6 pb-24 pt-28 sm:px-10 sm:pt-36">
        {/* Type left, photograph right — the same shape as the cover, and
            the same frame the cover's index shows for this discipline, so
            clicking CAMPAIGNS lands on the picture that was just on screen.

            The frame is portrait, so it sits in a column rather than being
            cropped into a banner, and the column is capped so the list of
            projects is still reachable without scrolling past a full screen
            of photograph. */}
        <header className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
          {/* Title first, unlike the cover — the photograph leads there
              because it is the hook, but somebody who has clicked
              "Campaigns" already knows what they came for, and what they
              want next is the list. */}
          <div>
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
              {projects.length} commissioned {projects.length === 1 ? "project" : "projects"}.
            </p>
          </div>

          {frame ? (
            <div
              className="relative w-full overflow-hidden lg:h-[clamp(20rem,42vh,26rem)] lg:w-auto"
              style={{
                backgroundColor: frame.color,
                aspectRatio: `${frame.width} / ${frame.height}`,
              }}
            >
              <Image
                src={frame.src}
                alt={frame.alt || `${name} work by Julian Gigola`}
                fill
                sizes="(min-width: 1024px) 30vw, 100vw"
                // The one photograph above the fold on this page.
                priority
                className="object-cover"
              />
            </div>
          ) : null}
        </header>

        <WorkIndex projects={projects} categories={WORK_CATEGORY_LINKS} active={slug} />
      </div>

      <CallToAction
        title={`Commission ${name.toLowerCase()}`}
        body="Send the brief and I'll come back with an approach, a crew, and a quote."
        type={projects[0] ? enquiryTypeFor(projects[0]) : "editorial"}
        secondary={{ href: "/work", label: "See all the work" }}
      />
    </>
  );
}
