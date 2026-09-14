import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectStrip } from "@/components/project-strip";
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
    <article>
      {/* One screen: the head over the sequence, the sequence across it, and
          a panel under it. Julian asked for the project pages to work like
          remyshoots.co.za, where a project is a filmstrip rather than a page
          you scroll down.

          `h-dvh` with the three children sized to fit inside it: the head
          and the panel take what they need, the strip takes the rest. So the
          photographs are as tall as the window allows on every screen
          without a single height being written down. */}
      <div className="flex h-dvh flex-col pt-24 sm:pt-28">
        <header className="mx-auto w-full max-w-[100rem] shrink-0 px-6 sm:px-10">
          {/* Three columns, the outer two the same width, so the title is
              centred on the page and not on whatever is left over. */}
          <div className="flex items-start justify-between gap-6">
            <div className="w-28 shrink-0 sm:w-44">
              <Crumb />
            </div>

            <div className="min-w-0 text-center">
              <h1 className="font-display text-2xl uppercase leading-none tracking-[0] sm:text-4xl">
                {project.headline ?? project.name}
              </h1>
              {client ? (
                <p className="label mt-2 text-muted-foreground">
                  {client.name}
                </p>
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

          {/* The intent, unless it is the title again, or a leftover credit
              line ("styling: @handle") which five projects carry and the
              credits below already say. Either can be rewritten in /admin. */}
          {project.intent &&
          !project.intent.includes("@") &&
          project.intent.trim().toLowerCase() !==
            project.name.trim().toLowerCase() ? (
            <p className="mx-auto mt-4 max-w-prose text-center text-sm leading-relaxed text-muted-foreground">
              {project.intent}
            </p>
          ) : null}
        </header>

        <ProjectStrip project={project} className="mt-6 flex-1" />

        {/* The panel under the ruler: the crew on the left, where to go next
            on the right. One line each rather than the column of rows this
            page used to carry beside the title, since a column that tall
            would take the height the photographs are using. Still all
            capitals and still a link per person, which is what Julian asked
            for when the credits moved up out of the footer. */}
        <footer className="mx-auto flex w-full max-w-[100rem] shrink-0 items-end justify-between gap-8 px-6 pb-5 pt-4 sm:px-10">
          {project.credits.length ? (
            <dl
              aria-label="Credits"
              className="flex min-w-0 flex-wrap gap-x-6 gap-y-1"
            >
              {project.credits.map((credit, i) => {
                /* Six harvested credits carry the handle as the name
                   ("@apricotsss3") with no instagram field; they link too. */
                const handle =
                  credit.instagram ??
                  (credit.name.startsWith("@") ? credit.name.slice(1) : null);
                return (
                  <div
                    key={`${credit.role}-${i}`}
                    className="group flex items-baseline gap-2"
                  >
                    <dt className="label text-muted-foreground/70">
                      {credit.role}
                    </dt>
                    <dd className="label">
                      {handle ? (
                        /* A new tab on purpose: the visitor is on a project
                           and taking the page out from under them to show
                           someone else's feed would lose their place. */
                        <a
                          href={`https://www.instagram.com/${handle}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
                        >
                          {credit.name}
                          <span className="sr-only">
                            {" "}
                            on Instagram (opens in a new tab)
                          </span>
                        </a>
                      ) : (
                        credit.name
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <span />
          )}

          {onwards ? (
            <Link
              href={onwards.href}
              className="label shrink-0 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
            >
              {onwards.name} &rarr;
            </Link>
          ) : null}
        </footer>
      </div>

      {/* The ask, at the point of peak interest. Below the first screen, and
          the strip hands the wheel over once the sequence runs out, so
          carrying on down the page is how you reach it. */}
      <CallToAction
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
