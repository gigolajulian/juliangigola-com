import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/gallery";
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

  return (
    <article className="pt-28 sm:pt-36">
      <header className="mx-auto max-w-[100rem] px-6 sm:px-10">
        <nav aria-label="Breadcrumb">
          <Link
            href="/work"
            className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
          >
            &larr; Back to all
          </Link>
        </nav>

        {/* The title on the left, the crew on the right — Julian moved the
            credits up here from the foot of the page. Each credit is a row
            of its own: role, then name, both in the label face, the name a
            link to the person where there is one. Rows respond to the
            pointer the way the index's rows do. */}
        <div className="mt-8 lg:flex lg:items-start lg:justify-between lg:gap-16">
          <h1 className="max-w-[24ch] title">
            {project.headline ?? project.name}
          </h1>

          {project.credits.length ? (
            <dl
              aria-label="Credits"
              className="mt-10 lg:mt-2 lg:w-[24rem] lg:shrink-0"
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
                    className="group flex items-baseline justify-between gap-6 border-b border-border py-2.5 transition-colors duration-200 hoverable:hover:border-foreground/30"
                  >
                    <dt className="label text-muted-foreground">
                      {credit.role}
                    </dt>
                    <dd className="label text-right">
                      {handle ? (
                        /* A new tab on purpose: the visitor is on a project
                         and taking the page out from under them to show
                         someone else's feed would lose their place in it. */
                        <a
                          href={`https://www.instagram.com/${handle}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground transition-colors duration-200 hoverable:group-hover:text-foreground"
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
          ) : null}
        </div>

        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 border-t border-border pt-6">
          {client ? (
            <div>
              <dt className="label text-muted-foreground">Client</dt>
              <dd className="mt-2 text-sm">{client.name}</dd>
            </div>
          ) : null}
          {/* Not on a discipline page, where it would repeat the title. */}
          {project.categories.length && !isDiscipline ? (
            <div>
              <dt className="label text-muted-foreground">Category</dt>
              <dd className="mt-2 text-sm">
                {project.categories.map((c) => c.name).join(", ")}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="label text-muted-foreground">
              {project.slug === COVER_ART?.slug ? "Releases" : "Frames"}
            </dt>
            <dd className="mt-2 text-sm">
              {project.slug === COVER_ART?.slug
                ? COVER_RELEASES.length
                : project.images.length}
            </dd>
          </div>
        </dl>

        {/* The intent, unless it is the title again — the harvester wrote
            `intent: "EVENT COVERAGE"` for the Event coverage gallery — or a
            leftover credit line ("styling: @handle"), which five projects
            carry and the credits beside the title already say. Either can
            be rewritten in /admin. */}
        {project.intent &&
        !project.intent.includes("@") &&
        project.intent.trim().toLowerCase() !==
          project.name.trim().toLowerCase() ? (
          <p className="mt-10 max-w-prose text-base leading-relaxed text-muted-foreground">
            {project.intent}
          </p>
        ) : null}
      </header>

      {/* Cover art is a catalogue, not a sequence: every frame is 1:1 and two
          of the releases are sleeves with two sides, so it gets a rack rather
          than the paired-frame spread the photographic work uses. */}
      {project.slug === COVER_ART?.slug ? (
        <CoverArtGallery releases={COVER_RELEASES} />
      ) : (
        <Gallery project={project} />
      )}

      {/* The ask, at the point of peak interest: they have just looked at the
          whole sequence. The form opens on this project's own branch, and the
          project name rides along so the enquiry says what prompted it. */}
      <CallToAction
        className="mt-24"
        title="Want something like this?"
        body="Tell me what you have in mind and I'll come back with an approach and a quote."
        type={enquiryTypeFor(project)}
        detail={project.name}
        secondary={
          onwards ? { href: onwards.href, label: onwards.name } : undefined
        }
      />
    </article>
  );
}
