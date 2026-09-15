import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectStrip, type NextUp } from "@/components/project-strip";
import { CoverArtGallery } from "@/components/cover-art-gallery";
import { CallToAction } from "@/components/call-to-action";
import {
  PROJECTS,
  COVER_ART,
  COVER_RELEASES,
  getProject,
  coverOf,
  enquiryTypeFor,
  isDisciplineGallery,
  nextAfter,
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
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(
  props: PageProps<"/work/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) return {};

  const client = project.credits.find((c) => /client/i.test(c.role));
  const description =
    project.intent ??
    [
      project.headline ?? project.name,
      client ? `for ${client.name}` : null,
      "by Julian Gigola",
    ]
      .filter(Boolean)
      .join(" ");

  return {
    title: project.name,
    description,
    alternates: { canonical: `/work/${project.slug}` },
    openGraph: {
      title: project.name,
      description,
      // The opening frame is the project's cover everywhere else on the site;
      // it should be the card in a Slack paste too.
      images: [
        {
          url: coverOf(project).src,
          width: coverOf(project).width,
          height: coverOf(project).height,
        },
      ],
    },
  };
}

export default async function ProjectPage(props: PageProps<"/work/[slug]">) {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) notFound();

  const client = project.credits.find((c) => /client/i.test(c.role));

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
          ? { href: `/work/${next.slug}`, name: `Next: ${next.name}` }
          : undefined;
      })();

  /* The strip's last cell and where the wheel goes past the end: the name
     of the next project, or of the next discipline's gallery when this page
     is a discipline. Its name and its client, not its pictures. */
  const nextProject = isDiscipline
    ? onwards && getProject(onwards.href.replace(/^\/work\//, ""))
    : nextAfter(project);
  const nextUp: NextUp | undefined = onwards
    ? {
        href: onwards.href,
        name: nextProject?.name ?? onwards.name,
        client: nextProject?.credits.find((c) => /client/i.test(c.role))
          ?.name,
      }
    : undefined;

  /* Cover art keeps the rack it was given: twenty-four sleeves at 1:1, two
     of them two-sided, which is a catalogue and not a sequence. Everything
     else is a sequence and gets the strip. */
  if (project.slug === COVER_ART?.slug) {
    return (
      <article className="pt-24 sm:pt-28">
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
          body="Tell me what you have in mind and I will come back with an approach and a quote."
          type={enquiryTypeFor(project)}
          detail={project.name}
          secondary={
            onwards ? { href: onwards.href, label: onwards.name } : undefined
          }
        />
      </article>
    );
  }

  return (
    /* `data-quiet-footer` does two jobs, both in `globals.css`: the site
       footer under this page is the one line of housekeeping rather than the
       ask every other page ends on, and from 40rem up the page is exactly
       the window with that line on it. Julian asked for a horizontal page
       that does not scroll vertically at all.

       One screen: the head over the sequence, the sequence across it, a
       panel under it. The children are sized to fit inside: the head and the
       panel take what they need and the strip takes the rest, so the
       photographs are as tall as the window allows on every screen without a
       single height being written down. `h-dvh` on a phone, which still
       scrolls its own height to reach the footer; `sm:h-full` above that,
       filling a `main` already sized to the window less the footer. */
    <article
      data-quiet-footer
      className="flex h-dvh min-h-0 flex-col pt-24 sm:h-full sm:pt-28"
    >
      <header className="mx-auto w-full max-w-[100rem] shrink-0 px-6 sm:px-10">
        {/* Three columns, the outer two the same width, so the title is
            centred on the page and not on whatever is left over. */}
        <div className="flex items-start justify-between gap-6">
          <div className="w-28 shrink-0 sm:w-44">
            <Crumb />
          </div>

          {/* The running head, and it waits its turn. The sequence opens on
              the title set large (see `project-strip.tsx`), so this would be
              the same words twice on the first screen. `running-head` fades
              it in once that card has been scrolled past — the rule is in
              `globals.css`, keyed off an attribute the strip sets. Julian
              asked for the top title to appear when the card goes away. */}
          <div className="running-head min-w-0 text-center">
            <h1 className="label font-semibold text-foreground">
              {project.headline ?? project.name}
            </h1>
            {client ? (
              <p className="label mt-1 text-muted-foreground">{client.name}</p>
            ) : null}
          </div>

          {/* What it is and how much of it there is, opposite the crumb. */}
          <p className="label w-28 shrink-0 text-right text-muted-foreground sm:w-44">
            {[
              project.categories.length && !isDiscipline
                ? project.categories.map((c) => c.name).join(", ")
                : null,
              `${project.images.length} frames`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      {/* Keyed, because the way from one project to the next is this same
          page with a new slug, and a strip that kept its scroll position and
          its counter across that would arrive at the end of the new sequence
          rather than the start.

          It carries the credits and the writing now. They used to be a row
          under the sequence; they open it instead, which is where Julian
          asked for them and which gives the page back the height that
          showing the footer costs. */}
      <ProjectStrip
        key={project.slug}
        project={project}
        next={nextUp}
        className="mt-6 flex-1"
      />
    </article>
  );
}

/** Back where they came from, in the corner both layouts put it. */
function Crumb() {
  return (
    <nav aria-label="Breadcrumb">
      <Link
        href="/work"
        className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
      >
        &larr; All work
      </Link>
    </nav>
  );
}
