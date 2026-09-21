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
  COMMISSIONS,
  PRESS_HOME,
  DISCIPLINES,
  WORK_PAGE,
  bandTile,
} from "@/lib/work";
import { ClientMarks } from "@/components/client-marks";

/* ── the homepage ─────────────────────────────────────────────────
 * One screen at a time, sideways. Each screen is a whole section rather
 * than a slice of one — the cover, the whole of the selected work, the rack
 * of sleeves, the two doors, the ask — and a notch, a swipe or an arrow
 * moves exactly one of them. Julian asked for the page to be
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
 *   2. Selected work — all nine on one screen, three across and three
 *      down, each tile scrubbing through its own sequence under the
 *      pointer. That answers the question a cover cannot: not "does this
 *      project exist" but "is the whole set good", which is a question
 *      about a set, so the set is on one screen with nothing behind it,
 *      and the client marks run in a line under it: the names that make an
 *      art director keep reading, beside what he made for them.
 *   3. Cover art, the two doors, and the ask, which leads on to the work.
 * ─────────────────────────────────────────────────────────────── */

/* The nine are one screen. The question the section answers is "is the
   whole set good", and a set is something you see at once — split over two
   screens it was a set of six and a set of three, and the second one was a
   page nobody knew was there.

   Five along the top and four under it, rather than three rows of three.
   The previews are upright, and three rows of an upright tile in the height
   a screen has left is a tile 155 wide: small enough that UKIYOSUNKNOWN came
   out UKIYOS... Two rows of a taller tile is the same nine pictures at half
   again the size, and the short row centres itself under the long one. */
export default function Home() {
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
          className="w-full shrink-0 max-sm:h-[100svh] sm:h-full"
        />

        {/* A grid, butting against itself: the section reads as one sheet
            of imagery rather than as cards in a frame, and the plate over
            each tile says whose it is. */}
        <section
          data-tick
          data-label="Selected work"
          data-hash="work"
          aria-label={`Selected work, ${FEATURED.length} projects`}
          className="relative flex w-full shrink-0 flex-col sm:h-full"
        >
          {/* Which section this is, and the way out to all of the work.
              Both sit in the band the bar occupies, which is why the grid
              below starts under it. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-baseline justify-between gap-6 px-6 py-4 sm:px-8 sm:pt-20">
            <p className="label glass-surface bg-background/70 px-3 py-1.5 text-muted-foreground">
              Selected work
              {/* Two, because upright screens stop at six (`band-grid` in
                  `globals.css`). A visitor who can count the tiles should
                  not be told a different number. */}
              <span className="ml-3 tabular-nums text-foreground">
                <span className="band-count-all">
                  {String(FEATURED.length).padStart(2, "0")}
                </span>
                <span className="band-count-few">
                  {String(Math.min(FEATURED.length, 6)).padStart(2, "0")}
                </span>
                {/* And eight, for an iPad held sideways, which shows four
                    across and two down (`band-grid` again). */}
                <span className="band-count-eight">
                  {String(Math.min(FEATURED.length, 8)).padStart(2, "0")}
                </span>
              </span>
            </p>
            <Link
              prefetch={false}
              href="/work"
              className="label pointer-events-auto glass-surface bg-background/70 px-3 py-1.5 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
            >
              <span aria-hidden>All {COMMISSIONS.length} &rarr;</span>
              <span className="sr-only">All {COMMISSIONS.length} projects</span>
            </Link>
          </div>

          {/* One grid, two rows, and every tile 4:5 against the height a
              row is given. Sizing the tiles from the height is what keeps
              the ratio exact at any window: the width follows, and five of
              them are still inside a 1280 screen. `max-content` columns, so
              they sit flush against each other and the row centres in
              whatever is left rather than being spread across it.

              It was two row elements with five tiles in each, and that is
              what made the first six impossible: taking three from each row
              gives you the first three and the sixth, seventh and eighth.
              One container in source order, and the ones that go are the
              ones after the sixth. `band-grid` in `globals.css` is where an
              upright screen takes over — three columns there, or one on a
              phone, and the width leads instead of the height, because a
              row of five at 4:5 against a 959px cell is 1310 wide and a
              strip cell does not clip.

              The top pad is the bar — the first row used to run under it. */}
          <div className="band-grid grid min-h-0 flex-1 content-center justify-center px-0 pt-0 sm:px-8 sm:pb-6 sm:pt-32">
            {FEATURED.map((project, i) => (
              <div
                key={project.slug}
                className="band-tile min-h-0 sm:aspect-[4/5] sm:h-full"
              >
                <WorkBand project={bandTile(project)} index={i} />
              </div>
            ))}
          </div>

          {/* The proof, where the proof is. It had a screen to itself and a
              screen of logos is a page a visitor swipes past to get back to
              photographs; a line under the work is read in the second it
              takes to pass it, which is all a logo needs. */}
          {PRESS_HOME.length ? (
            <section
              aria-labelledby="press"
              className="flex shrink-0 flex-col items-center gap-4 border-t border-border px-6 py-5 sm:flex-row sm:justify-center sm:gap-10 sm:px-8"
            >
              <h2 id="press" className="label shrink-0 text-muted-foreground">
                Published &amp; commissioned by
              </h2>
              <ClientMarks clients={PRESS_HOME} layout="row" />
            </section>
          ) : null}
        </section>

        <CoverArt />

        <Testimonials cells />

        {/* Julian: merge these, there is too much white space. The ask and
            the two doors were two screens of mostly paper asking the same
            thing, with the second repeating the first's "See the work".
            One screen: the question on the left, and on the right the two
            audiences split — an art director and somebody pricing a
            graduation shoot each get one obvious door, which is the fix
            for the old site's thirteen-item dropdown maze.

            `#where-next` still resolves: the strip finds the cell holding
            whatever the address names, and that id is on the doors. */}
        <EnquiryCell
          title="Have something in mind?"
          body="Tell me what you have in mind and I'll come back with an approach and a quote."
          next={WORK_PAGE}
          className="border-l border-border"
          aside={
            <div
              id="where-next"
              className="grid h-full grid-rows-2 gap-px bg-border"
            >
              <PathCard
                href="/work"
                label="For art directors"
                title="See the work"
                body="Editorial, campaigns, portraits, and artist imagery."
              />
              <PathCard
                href="/sessions"
                label="For individuals"
                title="Book a session"
                body="Graduation, headshots, weddings, and studio digitals. What's included and how long it takes."
              />
            </div>
          }
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
      className="group relative flex flex-col justify-center gap-6 border-l border-border bg-background px-6 py-12 transition-colors duration-300 hoverable:hover:bg-card sm:px-16 sm:pt-20"
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
