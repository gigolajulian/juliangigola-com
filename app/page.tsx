import type { CSSProperties } from "react";
import Link from "next/link";
import { CoverFloat } from "@/components/cover-float";
import { Strip } from "@/components/strip";
import { StripPage } from "@/components/strip-page";
import { EnquiryCell } from "@/components/enquiry-cell";
import { Testimonials } from "@/components/testimonials";
import { WorkBand } from "@/components/work-band";
import TiltedCard from "@/components/TiltedCard";
import { InquireWall } from "@/components/inquire-wall";
import {
  FEATURED,
  DISCIPLINE_TILES,
  PRESS_HOME,
  PROJECTS,
  projectsIn,
  WALL,
  WORK_PAGE,
} from "@/lib/work";
import { ClientMarks } from "@/components/client-marks";
import { AboutScreen } from "@/components/about-screen";
import { ContactScreen } from "@/components/contact-screen";
import { SessionsScreen } from "@/components/sessions-screen";
import { SESSION_TYPES, formatPrice } from "@/lib/sessions";

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
 *   3. Cover art, About, Contact, and last the two doors and the ask,
 *      which leads on to the work.
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
        label="Julian Gigola: the cover, selected work, cover art, about, contact, and how to get in touch. One screen at a time, left and right."
        next={WORK_PAGE}
        arrive="none"
        paged
        // Julian: the ScrollStack, sideways. Each screen slides over the one
        // before, which sinks back under it (`lib/deck.ts`).
        deck="screens"
        bleed
        className="flex-1"
      >
        {/* Julian: the cover as skvarenina.com opens, with his work. */}
        <CoverFloat
          work={FEATURED}
          className="w-full shrink-0 max-sm:h-[100svh] sm:h-full"
        />

        {/* A grid, butting against itself: the section reads as one sheet
            of imagery rather than as cards in a frame, and the plate over
            each tile says whose it is. */}
        <section
          data-tick
          /* Julian: Services, at #services (it was Selected work, #work). */
          data-label="Services"
          data-hash="services"
          aria-label={`Services, ${DISCIPLINE_TILES.length} disciplines`}
          className="relative flex w-full shrink-0 flex-col sm:h-full"
        >
          {/* Julian: the best photo from each discipline, leading to its
              project, in two rows, and what each is on its plate: photo,
              design or video (`.disc` in `globals.css`). */}
          <div
            className="disc min-h-0 flex-1 px-6 pt-6 sm:px-8 sm:pb-4 sm:pt-24 lying:pb-2 lying:pt-20"
            style={{ "--n": DISCIPLINE_TILES.length } as CSSProperties}
          >
            <div className="disc-inner">
              {DISCIPLINE_TILES.map((tile, i) => (
                <div key={tile.name} className="band-tile disc-tile">
                  {/* Julian: the cover art's motion here instead (React
                      Bits' TiltedCard), tilting toward the pointer and
                      lifting. */}
                  <TiltedCard
                    imageSrc={tile.cover.src}
                    altText={tile.name}
                    containerHeight="100%"
                    imageHeight="100%"
                    imageWidth="100%"
                    scaleOnHover={1.05}
                    /* Julian: half the tilt (14deg by default), then less. */
                    rotateAmplitude={4}
                    showMobileWarning={false}
                    showTooltip={false}
                  >
                    <WorkBand project={tile} index={i} />
                  </TiltedCard>
                </div>
              ))}
            </div>
          </div>

          {/* The proof, where the proof is. It had a screen to itself and a
              screen of logos is a page a visitor swipes past to get back to
              photographs; a line under the work is read in the second it
              takes to pass it, which is all a logo needs. */}
          {PRESS_HOME.length ? (
            <section
              aria-labelledby="press"
              className="flex shrink-0 flex-col items-center gap-4 border-t border-border px-6 py-5 sm:flex-row sm:justify-center sm:gap-10 sm:px-8 lying:gap-5 lying:py-2.5"
            >
              <h2 id="press" className="label shrink-0 text-muted-foreground">
                Published &amp; commissioned by
              </h2>
              <ClientMarks clients={PRESS_HOME} layout="row" className="max-sm:hidden" />
              {/* Julian: on a phone, one line that scrolls, as on the About
                  page (`about-marquee` in `globals.css`): the list twice,
                  the second out of reach of keys and readers. */}
              <div className="about-marquee w-full sm:hidden">
                <div className="about-marquee-track">
                  <ClientMarks clients={PRESS_HOME} layout="row" className="about-marquee-list" />
                  <div inert aria-hidden>
                    <ClientMarks clients={PRESS_HOME} layout="row" className="about-marquee-list" />
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </section>

        <Testimonials cells />

        {/* Julian: Sessions, About and Contact on the homepage, before
            the ask, which stays last. /about and /contact redirect here.
            Each session shows the sample /sessions shows. */}
        <SessionsScreen
          sessions={SESSION_TYPES.map((s) => {
            const sample =
              (s.sample && PROJECTS.find((p) => p.slug === s.sample)) ||
              projectsIn(s.slug)[0];
            return {
              slug: s.slug,
              name: s.name,
              rate: formatPrice(s.from),
              turnaround: s.turnaround,
              blurb: s.blurb,
              includes: s.includes,
              cover: sample ? sample.cover : null,
            };
          })}
        />
        <AboutScreen />
        <ContactScreen />

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
          /* Julian: the photo wall on the last page, as on the intro and
             the 404. Behind the ask and the two doors, dimmed so both
             still read; the doors are frosted glass over it. Each tile a way into
             its project, as on the 404. Four dozen, which covers the widest
             screen (`intro.tsx` has the arithmetic). */
          backdrop={
            <InquireWall items={WALL.slice(0, 48)} />
          }
          aside={
            <div
              id="where-next"
              className="grid h-full grid-rows-2 divide-y divide-border"
            >
              <PathCard
                href="/portfolio"
                title="See the work"
                body="Editorial, campaigns, portraits, and artist imagery."
              />
              <PathCard
                href="/#sessions"
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
  title,
  body,
}: {
  href: string;
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
      /* Julian: the wall runs on behind the doors, seen rather than
         frosted over: a 30% tint for the type and 6px of blur, not the
         site's glass. */
      className="group relative flex flex-col justify-center gap-6 border-l border-border bg-background/30 px-6 py-12 backdrop-blur-[var(--door-blur,1px)] transition-colors duration-300 hoverable:hover:bg-background/45 sm:px-16 sm:pt-20 lying:gap-3 lying:px-10 lying:py-3 lying:first:pt-16"
    >
      <div>
        {/* Julian: no audience line over the title, on any screen. */}
        <h3 className="title lying:[--text-title:1.75rem]">{title}</h3>
        {/* A phone on its side has the height for the door, not its
            description. */}
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground lying:hidden">
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
