import Link from "next/link";
import { Hero } from "@/components/hero";
import { Strip } from "@/components/strip";
import { StripPage } from "@/components/strip-page";
import { EnquiryCell } from "@/components/enquiry-cell";
import { Testimonials } from "@/components/testimonials";
import { WorkBand } from "@/components/work-band";
import { CoverArt } from "@/components/cover-art";
import {
  FEATURED,
  PRESS_HOME,
  DISCIPLINES,
  WORK_PAGE,
  bandTile,
} from "@/lib/work";
import { ClientMarks } from "@/components/client-marks";

/* ── the homepage ─────────────────────────────────────────────────
 * The same four moves the page has always made, now as one sequence that
 * runs sideways like the rest of the site:
 *
 *   1. The cover — who he is and what he does, cycling through the four
 *      disciplines so the range lands in the first few seconds. See
 *      `hero.tsx`; the discipline index is both its control and the site's
 *      navigation into the work. It is the first cell and it is the whole
 *      screen, so nothing about the first impression changes.
 *   2. Proof — the names that make an art director keep reading.
 *   3. Selected work — the picked projects as tiles the height of the
 *      strip, each scrubbable through its own sequence, then the rack of
 *      sleeves.
 *   4. The two doors, and then the ask. Wheeling past the ask leads to the
 *      work, which is where a visitor who got that far is going.
 *
 * The cover keeps its own arrival and nothing slides it in: `arrive="none"`
 * on the strip. Julian's standing rule is that nothing moves inside the
 * cover photograph.
 * ─────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <StripPage>
      <Strip
        label="Julian Gigola: the cover, selected work, cover art, and how to get in touch. Left and right."
        next={WORK_PAGE}
        arrive="none"
        className="flex-1"
      >
        {/* The cover is full bleed: it pulls back over the strip's own
            gutter, so at rest the photograph is the screen and there is no
            band of ground down its left. Every cell after it keeps the
            gutter. */}
        <Hero
          disciplines={DISCIPLINES}
          className="-ml-6 w-screen shrink-0 max-sm:min-h-[100lvh] sm:-ml-10 sm:h-full"
        />

        {PRESS_HOME.length ? (
          <section
            data-tick
            data-label="Clients"
            aria-labelledby="press"
            className="flex w-full shrink-0 flex-col justify-center gap-6 py-10 sm:h-full sm:w-[min(36rem,60vw)] sm:py-0 sm:pl-10"
          >
            <h2 id="press" className="label text-muted-foreground">
              Published &amp; commissioned by
            </h2>
            {/* One component with /studio's wall, so a logo added once shows
                in both places and neither can be the one still set in type. */}
            <ClientMarks clients={PRESS_HOME} layout="row" />
          </section>
        ) : null}

        <div
          data-tick
          data-label="Selected work"
          data-hash="work"
          className="flex w-full shrink-0 flex-col justify-center gap-3 py-6 sm:h-full sm:w-[min(18rem,40vw)] sm:py-0"
        >
          <h2 className="label text-muted-foreground">Selected work</h2>
          {/* However many are picked in /admin, counted rather than
              written down: the last copy that said "six" outlived the six. */}
          <p className="font-display text-3xl uppercase leading-none tracking-[0] sm:text-4xl">
            {FEATURED.length} projects
          </p>
          <Link
            prefetch={false}
            href="/work"
            className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
          >
            All projects &rarr;
          </Link>
        </div>

        {/* Each tile is the height of the strip and 4:5 of that across —
            the ratio the work is shot in — and scrubs through its own
            sequence under the pointer. That answers the question a cover
            cannot: not "does this project exist" but "is the whole set
            good", which is what an art director is actually deciding. */}
        {FEATURED.map((project, i) => (
          <WorkBand
            key={project.slug}
            project={bandTile(project)}
            index={i}
            priority={i < 2}
          />
        ))}

        <CoverArt />

        {/* The two audiences, split. This is the fix for the old site's
            single thirteen-item dropdown maze: an art director and someone
            pricing a graduation shoot each get one obvious door. */}
        <section
          data-tick
          data-label="Where next"
          aria-labelledby="paths"
          className="w-full shrink-0 sm:h-full sm:w-[min(60rem,80vw)]"
        >
          <h2 id="paths" className="sr-only">
            Where to go next
          </h2>
          <div className="grid h-full grid-cols-1 sm:grid-cols-2">
            <PathCard
              href="/work"
              label="For art directors"
              title="Commissioned work"
              body="Editorial, campaigns, portraits, and artist imagery."
            />
            <PathCard
              href="/sessions"
              label="For individuals"
              title="Book a session"
              body="Graduation, headshots, weddings, and studio digitals. What's included and how long it takes."
            />
          </div>
        </section>

        <Testimonials cells />

        <EnquiryCell
          title="Have something in mind?"
          body="Tell me what you have in mind and I'll come back with an approach and a quote."
          secondary={{ href: "/work", label: "Browse the work" }}
          next={WORK_PAGE}
        />
      </Strip>
    </StripPage>
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
      className="group relative flex flex-col justify-between gap-10 px-6 py-10 transition-colors duration-300 hoverable:hover:bg-card sm:px-10 sm:py-16 sm:first:border-r sm:first:border-border"
    >
      <div>
        <p className="label text-muted-foreground">{label}</p>
        <h3 className="mt-5 title">{title}</h3>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
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
