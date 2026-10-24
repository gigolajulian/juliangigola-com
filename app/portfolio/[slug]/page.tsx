import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CoverArtGallery } from "@/components/cover-art-gallery";
import { CallToAction } from "@/components/call-to-action";
import { SESSION_SEO } from "@/lib/seo";
import { V3Project } from "@/components/v3/project";
import {
  LINKABLE,
  UNLISTED,
  COVER_ART,
  COVER_RELEASES,
  getProject,
  coverOf,
  enquiryTypeFor,
  isDisciplineGallery,
  nextAfter,
  credited,
  nextDiscipline,
} from "@/lib/work";

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

  const client = credited(project, /client/i);
  const model = project.credits.find((c) => /model|in frame/i.test(c.role));
  const discipline = project.categories[0]?.name.toLowerCase();
  const n = project.images.length;
  /* What a pasted link shows under the title. The intent copy when there
     is one, cut to a sentence's worth; otherwise built from what the
     manifest knows: "HUA: brand campaigns by Julian Gigola, 17 frames, with
     @0414lei. San Francisco Bay Area." Twenty characters was what a shared
     project used to get. */
  /* A bookable session's gallery (Headshots, Graduation, Weddings) is
     titled for the search that books it, from `lib/seo.ts`. */
  const session = SESSION_SEO[project.slug];
  const title = session?.title ?? project.name;
  const description = session
    ? session.description
    : project.intent
    ? project.intent.length > 155
      ? project.intent.slice(0, 152).replace(/\s+\S*$/, "") + "…"
      : project.intent
    : [
        `${project.headline ?? project.name}: ${discipline ?? "photography"} by Julian Gigola`,
        client ? `for ${client}` : null,
        `${n} ${n === 1 ? "frame" : "frames"}`,
        model ? `with ${model.name}` : null,
      ]
        .filter(Boolean)
        .join(", ") + ". San Francisco Bay Area.";

  return {
    title,
    description,
    alternates: { canonical: `/portfolio/${project.slug}` },
    /* Unlisted means unlisted. The sitemap already leaves it out, but a
       page off every index that Google still holds is a page Julian took
       off the site and can be found on it anyway - by the one listing he
       does not control. `follow`, because the links out of it are to work
       that is published. */
    ...(UNLISTED.has(project.slug)
      ? { robots: { index: false, follow: true } }
      : {}),
    openGraph: {
      title,
      description,
      // The opening frame is the project's cover everywhere else on the site;
      // it should be the card in a Slack paste too.
      images: [
        {
          url: coverOf(project).src,
          width: coverOf(project).width,
          height: coverOf(project).height,
          alt: project.name,
        },
      ],
    },
    /* The root names the eye mark for every card, and a named field is
       inherited whole: a project pasted into X or Slack showed the logo
       while the Open Graph card next to it showed the work. */
    twitter: { card: "summary_large_image", images: [coverOf(project).src] },
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
    return (
      <article className="pt-20 sm:pt-20">
        <header className="mx-auto max-w-[100rem] px-6 sm:px-10">
          <Crumb />
          <h1 className="mt-6 title">{project.headline ?? project.name}</h1>
          <p className="label mt-3 text-muted-foreground">
            {COVER_RELEASES.length} releases
          </p>
        </header>
        <CoverArtGallery releases={COVER_RELEASES} />
        <CallToAction
          className="mt-24"
          title="Want something like this?"
          body="Tell me what you have in mind and I'll come back with a treatment and a rate."
          type={enquiryTypeFor(project)}
          detail={project.name}
          secondary={
            onwards ? { href: onwards.href, label: onwards.name } : undefined
          }
        />
      </article>
    );
  }

  /* JG V3 (leftovers card B): a vertical page, the client's logo in the head. */
  return <V3Project project={project} next={onwards} />;
}

/** Back where they came from, in the corner both layouts put it. */
function Crumb() {
  return (
    <nav aria-label="Breadcrumb">
      <Link
        href="/portfolio"
        /* One line: on a phone the head's middle column left it 37px
           and the arrow stood over the word. Padded to a 26px target
           and pulled back by as much. */
        className="label -my-1.5 inline-block whitespace-nowrap py-1.5 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
      >
        &larr; Portfolio
      </Link>
    </nav>
  );
}
