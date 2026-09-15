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
 * One screen at a time, sideways. Each screen is a whole section rather
 * than a slice of one — the cover, the proof, the work three frames at a
 * time, the rack of sleeves, the two doors, the ask — and a notch, a swipe
 * or an arrow moves exactly one of them. Julian asked for the page to be
 * sectioned off, with the movement between sections meaning something:
 * a gesture is "the next thing", never "a bit further along".
 *
 * The moves are the ones the page has always made, in the order a first
 * visitor asks for them:
 *
 *   1. The cover — who he is and what he does, cycling through the
 *      disciplines so the range lands in the first few seconds. It is the
 *      first screen and it is the whole screen, so nothing about the first
 *      impression changes. `arrive="none"`: nothing slides the photograph
 *      in, and nothing moves inside it.
 *   2. Proof — the names that make an art director keep reading.
 *   3. Selected work — a grid of six a screen, edge to edge, each tile
 *      scrubbing through its own sequence under the pointer. That answers
 *      the question a cover cannot: not "does this project exist" but "is
 *      the whole set good", which is a question about a set and so wants
 *      the set on one screen.
 *   4. Cover art, the two doors, and the ask, which leads on to the work.
 * ─────────────────────────────────────────────────────────────── */

/** Tiles to a screen: a grid three across and two down. Six at a time is
    what the section is for — the question it answers is "is the whole set
    good", and a set is something you see at once. A screen that does not
    fill both rows keeps the same cells and centres the row it has, so the
    tiles are one size across the whole section. */
const COLUMNS = 3;
const PER_SCREEN = COLUMNS * 2;

const screensOf = <T,>(all: T[], n: number) =>
  Array.from({ length: Math.ceil(all.length / n) }, (_, i) =>
    all.slice(i * n, i * n + n),
  );

export default function Home() {
  const screens = screensOf(FEATURED, PER_SCREEN);

  return (
    <StripPage>
      <Strip
        label="Julian Gigola: the cover, selected work, cover art, and how to get in touch. One screen at a time, left and right."
        next={WORK_PAGE}
        arrive="none"
        paged
        bleed
        className="flex-1"
      >
        <Hero
          disciplines={DISCIPLINES}
          // A height and not a floor: the type column inside takes its own
          // height from this one, and against a floor it collapsed to its
          // contents and settled at the top of the screen — the name half
          // under the bar and the photograph below it.
          className="w-full shrink-0 max-sm:h-[100lvh] sm:h-full"
        />

        {PRESS_HOME.length ? (
          <section
            data-tick
            data-label="Clients"
            data-hash="clients"
            aria-labelledby="press"
            className="flex w-full shrink-0 flex-col justify-center gap-10 border-l border-border px-6 py-16 sm:h-full sm:px-16 sm:pb-0 sm:pt-24"
          >
            <h2 id="press" className="label text-muted-foreground">
              Published &amp; commissioned by
            </h2>
            {/* One component with /studio's wall, so a logo added once shows
                in both places and neither can be the one still set in type.
                Held to a column rather than the whole screen: eight marks
                spread across 1440px is a row of stragglers, and at this
                width they read as a wall of four. */}
            <ClientMarks
              clients={PRESS_HOME}
              layout="grid"
              className="max-w-[56rem] gap-x-16 gap-y-16"
            />
          </section>
        ) : null}

        {/* A grid, butting against itself: the section reads as one sheet
            of imagery rather than as cards in a frame, and the plate over
            each tile says whose it is. The label in the corner says which
            screen of the section you are on. */}
        {screens.map((screen, s) => (
          <section
            key={`work-${s}`}
            data-tick
            data-label="Selected work"
            data-hash={s === 0 ? "work" : undefined}
            aria-label={`Selected work, screen ${s + 1} of ${screens.length}`}
            className="relative flex w-full shrink-0 flex-col sm:h-full"
          >
            {/* Which section this is and how far through it, over the
                photographs and under the fixed bar. The ruler says the
                section too; this says the count, and carries the way out
                to all of the work. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-baseline justify-between gap-6 px-6 py-4 sm:px-8 sm:pt-24">
              <p className="label glass-surface bg-background/70 px-3 py-1.5 text-muted-foreground">
                Selected work
                <span className="ml-3 tabular-nums text-foreground">
                  {String(s + 1).padStart(2, "0")} /{" "}
                  {String(screens.length).padStart(2, "0")}
                </span>
              </p>
              <Link
                prefetch={false}
                href="/work"
                className="label pointer-events-auto glass-surface bg-background/70 px-3 py-1.5 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
              >
                All {FEATURED.length} &rarr;
              </Link>
            </div>

            {/* Rows are half the screen each, whether the screen has one
                of them or two, so every tile in the section is the same
                size; a short last screen centres its row rather than
                leaving a hole under it. */}
            <div className="grid min-h-0 flex-1 content-center grid-cols-1 sm:grid-cols-3 sm:[grid-auto-rows:50%]">
              {screen.map((project, i) => (
                <WorkBand
                  key={project.slug}
                  project={bandTile(project)}
                  index={s * PER_SCREEN + i}
                  priority={s === 0 && i < PER_SCREEN}
                />
              ))}
            </div>
          </section>
        ))}

        <CoverArt />

        {/* The two audiences, split. This is the fix for the old site's
            single thirteen-item dropdown maze: an art director and someone
            pricing a graduation shoot each get one obvious door, and here
            they get half a screen each. */}
        <section
          data-tick
          data-label="Where next"
          data-hash="where-next"
          aria-labelledby="paths"
          className="w-full shrink-0 sm:h-full"
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
          className="border-l border-border px-6 sm:w-full sm:px-16"
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
      // Centred rather than stretched top to bottom: half a screen each is
      // more room than two short paragraphs need, and a block pinned to the
      // top with its way out pinned to the bottom reads as a page that
      // failed to load the middle.
      className="group relative flex flex-col justify-center gap-6 border-l border-border px-6 py-12 transition-colors duration-300 hoverable:hover:bg-card sm:px-16 sm:pt-24"
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
