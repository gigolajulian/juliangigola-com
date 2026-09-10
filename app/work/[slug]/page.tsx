import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/gallery";
import { CallToAction } from "@/components/call-to-action";
import { PROJECTS, getProject, coverOf, enquiryTypeFor, nextAfter } from "@/lib/work";

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

export async function generateMetadata(props: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) return {};

  const client = project.credits.find((c) => /client/i.test(c.role));
  const description =
    project.intent ??
    [project.headline ?? project.name, client ? `for ${client.name}` : null, "by Julian Gigola"]
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
      images: [{ url: coverOf(project).src, width: coverOf(project).width, height: coverOf(project).height }],
    },
  };
}

export default async function ProjectPage(props: PageProps<"/work/[slug]">) {
  const { slug } = await props.params;
  const project = getProject(slug);
  if (!project) notFound();

  const client = project.credits.find((c) => /client/i.test(c.role));
  const next = nextAfter(project);

  return (
    <article className="pt-28 sm:pt-36">
      <header className="mx-auto max-w-[100rem] px-6 sm:px-10">
        <nav aria-label="Breadcrumb">
          <Link
            href="/work"
            className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
          >
            &larr; Work
          </Link>
        </nav>

        <h1 className="mt-8 max-w-[24ch] title">
          {project.headline ?? project.name}
        </h1>

        <dl className="mt-8 flex flex-wrap gap-x-12 gap-y-4 border-t border-border pt-6">
          {client ? (
            <div>
              <dt className="label text-muted-foreground">Client</dt>
              <dd className="mt-2 text-sm">{client.name}</dd>
            </div>
          ) : null}
          {project.categories.length ? (
            <div>
              <dt className="label text-muted-foreground">Category</dt>
              <dd className="mt-2 text-sm">
                {project.categories.map((c) => c.name).join(", ")}
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="label text-muted-foreground">Frames</dt>
            <dd className="mt-2 text-sm">{project.images.length}</dd>
          </div>
        </dl>

        {project.intent ? (
          <p className="mt-10 max-w-prose text-base leading-relaxed text-muted-foreground">
            {project.intent}
          </p>
        ) : null}
      </header>

      <Gallery project={project} />

      {/* Credits at the end, not the top. Someone reads them once they have
          decided they like the work — putting them first asks a stranger to
          care about a crew they have no reason to care about yet. */}
      {project.credits.length ? (
        <footer className="mx-auto mt-24 max-w-[100rem] px-6 sm:px-10">
          <h2 className="label text-muted-foreground">Credits</h2>
          <dl className="mt-6 grid gap-x-12 gap-y-6 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-3">
            {project.credits.map((credit, i) => (
              <div key={`${credit.role}-${i}`}>
                <dt className="label text-muted-foreground">{credit.role}</dt>
                <dd className="mt-2 text-sm">{credit.name}</dd>
              </div>
            ))}
          </dl>
        </footer>
      ) : null}

      {/* The ask, at the point of peak interest: they have just looked at the
          whole sequence. The form opens on this project's own branch, and the
          project name rides along so the enquiry says what prompted it. */}
      <CallToAction
        className="mt-24"
        title="Want something like this?"
        body="Tell me the brief and I'll come back with an approach, a crew, and a quote."
        type={enquiryTypeFor(project)}
        detail={project.name}
        secondary={next ? { href: `/work/${next.slug}`, label: `Next: ${next.name}` } : undefined}
      />
    </article>
  );
}
