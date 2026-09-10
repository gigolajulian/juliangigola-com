import Link from "next/link";
import { Hero } from "@/components/hero";
import { CallToAction } from "@/components/call-to-action";
import { Testimonials } from "@/components/testimonials";
import { WorkBand } from "@/components/work-band";
import { CoverArt } from "@/components/cover-art";
import { FEATURED, PRESS, DISCIPLINES } from "@/lib/work";

/* ── the homepage ─────────────────────────────────────────────────
 * Four moves, in the order a first-time visitor asks for them.
 *
 *   1. The cover — who he is and what he does, cycling through the four
 *      disciplines so the range lands in the first few seconds. See
 *      `hero.tsx`; the discipline index is both its control and the site's
 *      navigation into the work.
 *   2. Proof — the five names that make an art director keep reading. On the
 *      old site they were four lines of grey text at the foot of /about.
 *   3. Selected work — a full-bleed grid, each cell scrubbable through its own
 *      sequence, so the question answered is "is the whole set good" rather
 *      than "does this project exist".
 *   4. The split, then the ask — an art director and someone pricing a
 *      graduation shoot each get one door, and then a single clear request.
 * ─────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <>
      <Hero disciplines={DISCIPLINES} />

      {/* Proof, in its own band directly under the cover — so it is the first
          thing past the fold rather than something to be scrolled past. */}
      <section aria-labelledby="press" className="border-b border-border">
        <div className="mx-auto flex max-w-[100rem] flex-wrap items-baseline gap-x-8 gap-y-4 px-6 py-8 sm:px-10 sm:py-10">
          <h2 id="press" className="label shrink-0 text-muted-foreground">
            Published &amp; commissioned by
          </h2>
          <ul className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {PRESS.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/work/${p.slug}`}
                  className="font-display text-lg uppercase tracking-[0.04em] text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground sm:text-xl"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Selected work: a full-bleed grid.
          Two columns running edge to edge, each cell most of the viewport
          tall. A photograph in a 400px card is a reference to a photograph;
          at this size it is the thing itself, which is the argument for
          giving the page over to it. Six cells at this scale means the
          section is the body of the homepage rather than a strip in it.

          No rules between the cells. The frames butt straight up against
          each other so the section reads as one sheet of imagery rather than
          as tiles in a frame — the photographs supply their own edges.

          Each cell scrubs through its own sequence under the pointer — see
          `work-band.tsx`. That answers the question a cover cannot: not "does
          this project exist" but "is the whole set good", which is what an
          art director is actually deciding. */}
      <section aria-labelledby="featured">
        <div className="mx-auto flex max-w-[100rem] items-baseline justify-between gap-6 px-6 pb-8 pt-20 sm:px-10 sm:pt-28">
          <h2 id="featured" className="label text-muted-foreground">
            Selected work
          </h2>
          <Link
            href="/work"
            className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
          >
            All projects &rarr;
          </Link>
        </div>

        <ul className="grid lg:grid-cols-2">
          {FEATURED.map((project, i) => (
            <li key={project.slug}>
              <WorkBand project={project} index={i} priority={i < 2} />
            </li>
          ))}
        </ul>
      </section>

      <CoverArt />

      {/* The two audiences, split. This is the fix for the old site's single
          thirteen-item dropdown maze: an art director and someone pricing a
          graduation shoot each get one obvious door. */}
      <section aria-labelledby="paths" className="border-t border-border">
        <h2 id="paths" className="sr-only">
          Where to go next
        </h2>
        <div className="mx-auto grid max-w-[100rem] sm:grid-cols-2">
          <PathCard
            href="/work"
            label="For art directors"
            title="Commissioned work"
            body="Editorial, campaigns, portraits, and artist imagery — with clients and credits."
          />
          <PathCard
            href="/sessions"
            label="For individuals"
            title="Book a session"
            body="Graduation, headshots, weddings, and studio digitals. What's included and how long it takes."
          />
        </div>
      </section>

      <Testimonials />

      <CallToAction
        title="Have something in mind?"
        body="Editorial, campaign, music, or a session. Tell me what it is and I'll come back with an approach and a quote."
        secondary={{ href: "/work", label: "Browse the work" }}
      />
    </>
  );
}

function PathCard({
  href,
  label,
  title,
  body,
}: {
  href: string;
  label: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between gap-16 px-6 py-16 transition-colors duration-300 hoverable:hover:bg-card sm:px-10 sm:py-24 sm:odd:border-r sm:odd:border-border"
    >
      <div>
        <p className="label text-muted-foreground">{label}</p>
        <h3 className="mt-5 title">{title}</h3>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>

      <span className="label inline-flex items-center gap-2 text-foreground">
        View
        <span
          aria-hidden
          className="transition-transform duration-300 ease-[var(--ease-out-strong)] hoverable:group-hover:translate-x-1 motion-reduce:transition-none"
        >
          &rarr;
        </span>
      </span>
    </Link>
  );
}
