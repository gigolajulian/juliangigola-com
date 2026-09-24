import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectStrip, type NextUp } from "@/components/project-strip";
import { StripPage, StripHead } from "@/components/strip-page";
import { CoverArtGallery } from "@/components/cover-art-gallery";
import { CallToAction } from "@/components/call-to-action";
import { SoleMark } from "@/components/client-marks";
import { CLIENT_MARKS } from "@/lib/clients-data";
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
  prevBefore,
  billing,
  nextDiscipline,
  markFor,
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
  props: PageProps<"/work/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) return {};

  const client = project.credits.find((c) => /client/i.test(c.role));
  const model = project.credits.find((c) => /model|in frame/i.test(c.role));
  const discipline = project.categories[0]?.name.toLowerCase();
  const n = project.images.length;
  /* What a pasted link shows under the title. The intent copy when there
     is one, cut to a sentence's worth; otherwise built from what the
     manifest knows: "HUA: brand campaigns by Julian Gigola, 17 frames, with
     @0414lei. San Francisco Bay Area." Twenty characters was what a shared
     project used to get. */
  const description = project.intent
    ? project.intent.length > 155
      ? project.intent.slice(0, 152).replace(/\s+\S*$/, "") + "…"
      : project.intent
    : [
        `${project.headline ?? project.name}: ${discipline ?? "photography"} by Julian Gigola`,
        client ? `for ${client.name}` : null,
        `${n} ${n === 1 ? "frame" : "frames"}`,
        model ? `with ${model.name}` : null,
      ]
        .filter(Boolean)
        .join(", ") + ". San Francisco Bay Area.";

  return {
    title: project.name,
    description,
    alternates: { canonical: `/work/${project.slug}` },
    /* Unlisted means unlisted. The sitemap already leaves it out, but a
       page off every index that Google still holds is a page Julian took
       off the site and can be found on it anyway - by the one listing he
       does not control. `follow`, because the links out of it are to work
       that is published. */
    ...(UNLISTED.has(project.slug)
      ? { robots: { index: false, follow: true } }
      : {}),
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

export default async function ProjectPage(props: PageProps<"/work/[slug]">) {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) notFound();

  const client = billing(project);

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

  /* A brand campaign whose client has a logo on file shows the logo top
     right, in place of the discipline and the frame count. Julian asked
     for it at 80% and full on hover. A campaign with no logo keeps the
     text. */
  const mark = project.categories.some((c) => c.slug === "campaigns")
    ? markFor(project.slug)
    : undefined;

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

  /* And where a wheel pushed past the start goes: the project before, by
     the same walk. A discipline gallery has no project before it. */
  const prevProject = isDiscipline ? undefined : prevBefore(project);
  const prevUp: NextUp | undefined = prevProject
    ? { href: `/work/${prevProject.slug}`, name: prevProject.name }
    : undefined;

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

  return (
    /* One screen: the head over the sequence, the sequence across it, a
       panel under it (`strip-page.tsx`, the chrome every horizontal page
       shares). `h-dvh` on a phone, which still scrolls its own height to
       reach the footer; from 40rem up the page is exactly the window. */
    <StripPage
      className="h-dvh"
      head={
        <StripHead
          crumb={<Crumb />}
          title={project.headline ?? project.name}
          sub={client}
          aside={
            mark && CLIENT_MARKS[mark.slug] ? (
              <span
                role="img"
                aria-label={mark.name}
                title={mark.name}
                data-aside-mark
              >
                <SoleMark
                  client={mark}
                  className="h-auto justify-end overflow-visible text-foreground opacity-80 transition-opacity duration-200 hoverable:hover:opacity-100 [--mark-box:1.45rem] [--mark-cap:9rem]"
                />
              </span>
            ) : (
              [
                project.categories.length && !isDiscipline
                  ? project.categories.map((c) => c.name).join(", ")
                  : null,
                `${project.images.length} frames`,
              ]
                .filter(Boolean)
                .join(" · ")
            )
          }
        />
      }
    >
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
        prev={prevUp}
        className="mt-6 flex-1"
      />
    </StripPage>
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
