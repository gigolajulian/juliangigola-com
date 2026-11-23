import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CoverPage } from "@/components/cover/cover-page";
import { SESSION_SEO } from "@/lib/seo";
import { projectFacts, shareMeta } from "@/lib/og/share";
import { ProjectView } from "@/components/portfolio/project";
import {
  LINKABLE,
  UNLISTED,
  COVER_ART,
  COVER_RELEASES,
  getProject,
  isDisciplineGallery,
  nextAfter,
  nextDiscipline,
} from "@/lib/work/work";

/* ── the case study ───────────────────────────────────────────────
 * The old site rendered a project as a grid of thumbnails with the credits
 * as four lines of plain text above it. For the one page an art director
 * actually evaluates, that buries everything that matters.
 *
 * So: the title and the client first, the sequence full width, and the
 * credits given a proper frame at the end — where someone who has just
 * looked at the work wants to know who else was on it.
 * ─────────────────────────────────────────────────────────────── */

export function generateStaticParams() {
  // `LINKABLE`, not `PROJECTS`: an unlisted project is off every index and
  // still has a page, which is the whole of what unlisted means.
  return LINKABLE.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/portfolio/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) return {};

  /* A bookable session's gallery (Headshots, Graduation, Weddings) keeps the
     title `lib/seo.ts` gives it for the search; its share card is unified. */
  const session = SESSION_SEO[project.slug];
  const facts = projectFacts(project);
  const card = shareMeta(project.name, facts.description);
  const title = session?.title ?? project.name;
  const description = session?.description ?? facts.description;

  return {
    title,
    description,
    // the weddings gallery is the same subject as /weddings, which is the page to rank (audit R1, 2026-11-16)
    alternates: { canonical: project.slug === "weddings" ? "/weddings" : `/portfolio/${project.slug}` },
    /* Unlisted means unlisted. The sitemap already leaves it out, but a
       page off every index that Google still holds is a page Julian took
       off the site and can be found on it anyway - by the one listing he
       does not control. `follow`, because the links out of it are to work
       that is published. */
    ...(UNLISTED.has(project.slug)
      ? { robots: { index: false, follow: true } }
      : {}),
    openGraph: card.openGraph,
    twitter: card.twitter,
  };
}

export default async function ProjectPage(props: PageProps<"/portfolio/[slug]">) {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) notFound();

  /* Four of these pages are not projects at all: Event coverage, Cover art,
     Automotive and Places are each one gallery published under a
     discipline's own slug, because there are no separate commissions behind
     them to list. Dressed as an ordinary project, Event coverage read:

       EVENT COVERAGE
       Category      Event coverage
       Frames        22
       Next: ÆRA:WRAITH

     A category row repeating the title, and a "next project" that leaves the
     subject for an unrelated mixed-media shoot. Both are fixed below. */
  const isDiscipline = isDisciplineGallery(project);

  /* Where the foot of the page goes. A discipline has no sibling project, so
     it follows the chips on /work to the next discipline instead of being
     handed whatever sits next in the running order. */
  const onwards = isDiscipline
    ? nextDiscipline(project.categories[0]?.slug ?? "")
    : (() => {
        const next = nextAfter(project);
        return next
          ? { href: `/portfolio/${next.slug}`, name: `Next: ${next.name}`, cover: next.images.find((f) => f.width <= f.height) ?? next.images[0] }
          : undefined;
      })();

  /* Cover art keeps the rack it was given: twenty-four sleeves at 1:1, two
     of them two-sided, which is a catalogue and not a sequence. Everything
     else is a sequence and gets the strip. */
  if (project.slug === COVER_ART?.slug) {
    return <CoverPage releases={COVER_RELEASES} onwards={onwards ? { href: onwards.href, name: onwards.name } : undefined} />;
  }

  /* JG V3 (leftovers card B): a vertical page, the client's logo in the head. */
  return <ProjectView project={project} next={onwards} />;
}
