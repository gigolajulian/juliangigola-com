"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { Discipline, Frame, Project } from "@/lib/work";

/* ── the cover ────────────────────────────────────────────────────
 * A masthead grid that opens on the job title and then cycles through the
 * things he actually does.
 *
 * "Photographer & creative director" is a job title; editorial, campaigns,
 * portraits and music are the things somebody might be here to commission. So
 * the title is set large over a picture of the city he works in, once, and
 * then hands off to the disciplines — each one set large in turn with work
 * from it behind — which says the range in the first few seconds in a way one
 * static cover cannot.
 *
 * This is not the carousel it could easily have become:
 *
 *   - The type leads and the image follows it. The switch is informational —
 *     it names a discipline and shows work from it — rather than a slideshow
 *     of pictures for their own sake.
 *   - Nothing moves. The change is a crossfade, no sliding, no zooming.
 *   - It is a control, not a decoration. The disciplines are a real index:
 *     hovering one previews it, clicking one goes to that work. The cycle is
 *     what happens while nobody is using it — it yields the moment somebody
 *     does, and takes the cover back three seconds after the mouse stops.
 *   - It respects `prefers-reduced-motion` by not cycling at all.
 *
 * Nothing is cropped. The frames run 0.71 to 0.80 in aspect and the column
 * cannot match all of them, so the picture is `object-contain`ed rather than
 * `cover`ed — the whole photograph is always on screen.
 *
 * What that leaves is a band of empty column, and the band is filled with
 * that frame's own dominant colour. So instead of letterbox bars it reads as
 * a print on a mount pulled from the picture, which is how a photograph gets
 * hung. The colour crossfades with the frame, so switching discipline changes
 * the mount too.
 * ─────────────────────────────────────────────────────────────── */

/** Long enough to read the word and take in the picture before it moves on. */
const DWELL_MS = 3500;

/** How still the mouse has to be before the cover goes back to cycling. */
const IDLE_MS = 3000;

/**
 * The opening frame. A title card, not a sixth discipline.
 *
 * It states the job once, over the city the work is made in, and then never
 * comes back — which is why it is absent from the numbered index below. A
 * picture that corresponds to no row, returning every lap, reads as a fault.
 *
 * Declared here rather than beside `COVER_OVERRIDES` in `lib/work.ts` on
 * purpose: this file is a client component, and importing a *value* from
 * `lib/work` would pull the whole generated archive into the browser bundle.
 * The type imports above are erased, so they cost nothing.
 *
 * Cropped to 4:5 from a 16:9 original and processed the way the archive is
 * (2500px, mozjpeg q82) — see README, "Adding a cover image".
 */
const INTRO: Slide = {
  slug: "intro",
  name: "Photographer & creative director",
  frame: {
    src: "/hero/intro.jpg",
    // 2456 rather than 2500: the 4:5 crop is capped by the original's 3070px
    // height, and upscaling to hit a round number adds bytes, not detail.
    width: 2456,
    height: 3070,
    color: "#867D74",
    alt: "Downtown San Francisco from the air at sunrise, the Transamerica Pyramid against the sun",
  },
};

/**
 * A discipline, or the intro — which has no project behind it, because a
 * cityscape is not a commission. The credit in the corner is absent rather
 * than invented for that one frame.
 */
type Slide = { slug: string; name: string; frame: Frame; project?: Project };

export function Hero({ disciplines }: { disciplines: Discipline[] }) {
  /**
   * What the cover runs through: the title card, then the disciplines.
   *
   * The index below still maps `disciplines`, so its rows are offset by one
   * from this — row `i` is slide `i + 1`, and during the intro no row is
   * current at all.
   */
  const slides: Slide[] = [INTRO, ...disciplines];

  /**
   * Which discipline is up, and which one it came from.
   *
   * One piece of state rather than two, because the pair has to move together
   * — the outgoing frame is only outgoing relative to the incoming one, and as
   * separate states they can render a frame mid-flight against the wrong
   * predecessor.
   *
   * `previous` is also the whole loading strategy. All five frames used to be
   * in the markup from the start so a switch would never wait on a request,
   * and that was a megabyte and a half of full-size photographs downloaded
   * before the visitor had done anything, competing with the one picture they
   * could actually see. Only these two are ever mounted: the one on screen and
   * the one crossfading out behind it.
   */
  const [slide, setSlide] = React.useState({ active: 0, previous: -1 });
  const { active } = slide;

  /** The cover itself — the surface whose pointer movement counts as use. */
  const sectionRef = React.useRef<HTMLElement>(null);

  /**
   * Whether the visitor currently has the cover, rather than the cycle.
   *
   * Pointing at the index takes it — moving on its own while somebody is
   * reading a row is fighting them for control. But this used to latch for
   * the life of the page, so one stray hover killed the cover: land on
   * COVER ART and the page simply stopped there, with four disciplines
   * never shown again.
   *
   * So it expires instead. Three seconds without the mouse moving is the
   * visitor having stopped, and the cycle picks up from wherever they left
   * it — 05 wrapping round to 01 like any other step.
   */
  const [held, setHeld] = React.useState(false);

  /** Pure — no side effects in the updater, which React may call twice. */
  const go = React.useCallback(
    (i: number) =>
      setSlide((s) => (s.active === i ? s : { active: i, previous: s.active })),
    [],
  );

  React.useEffect(() => {
    if (held || slides.length < 2) return;

    // Nothing will advance, so the intro would be the whole cover: a picture
    // with no discipline named, no row current, and the running head below
    // held invisible for good. These visitors get the cover as it was before
    // the title card existed — straight to the first discipline.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSlide({ active: 1, previous: -1 });
      return;
    }

    const id = window.setInterval(
      () =>
        setSlide((s) => ({
          // Wraps to 1, not 0. The intro plays once and is then out of the
          // rotation for the life of the page.
          active: s.active + 1 >= slides.length ? 1 : s.active + 1,
          previous: s.active,
        })),
      DWELL_MS,
    );
    return () => window.clearInterval(id);
  }, [held, slides.length]);

  /**
   * Hands the cover back once the mouse has been still for `IDLE_MS`.
   *
   * The timer is re-armed by movement anywhere over the cover, not just over
   * the index — someone reading the photograph with the pointer drifting
   * across it is still using the page, and yanking the frame out from under
   * them would be the same rudeness as moving while they read a row.
   *
   * Only mounted while held, so the listener does not exist at all in the
   * common case of nobody having touched anything.
   */
  React.useEffect(() => {
    if (!held) return;

    let id = 0;
    const rearm = () => {
      window.clearTimeout(id);
      id = window.setTimeout(() => {
        // A keyboard visitor holds a row without ever moving a mouse, so "the
        // mouse stopped" is not evidence they are done. Resuming under them
        // would walk the cover forward while they tab it.
        if (sectionRef.current?.contains(document.activeElement)) return rearm();
        setHeld(false);
      }, IDLE_MS);
    };

    rearm();
    // On the section rather than the window: movement down in the footer is
    // not somebody using a cover that is long since off screen.
    const section = sectionRef.current;
    section?.addEventListener("pointermove", rearm, { passive: true });
    return () => {
      window.clearTimeout(id);
      section?.removeEventListener("pointermove", rearm);
    };
  }, [held]);

  const take = (i: number) => {
    setHeld(true);
    go(i);
  };

  /** Finds which row an event came from and switches to it. */
  const takeFromEvent = (e: React.SyntheticEvent) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-discipline]");
    if (!row) return;
    const i = Number(row.dataset.discipline);
    if (Number.isInteger(i)) take(i);
  };

  const current = slides[active];
  if (!current) return null;

  return (
    <section ref={sectionRef} className="border-b border-border">
      {/* A column on a phone, two columns from `lg`.
       *
       * Three children rather than two, because on a phone the photograph
       * belongs *between* the name and the index — the name has to be the
       * first thing on the screen, and the index and the buttons have to
       * follow the picture rather than precede it. A single text column
       * cannot be interrupted like that, so it is split and the pieces are
       * placed explicitly above `lg`, where they reassemble into the left
       * column with the photograph beside them.
       */}
      <div className="flex flex-col lg:grid lg:h-dvh lg:grid-cols-[1fr_auto] lg:grid-rows-[auto_1fr]">
        {/* The photograph leads on a phone — it is the hook — but it is held
            to half the screen so the name and both ways in stay visible
            without scrolling. */}
        <div
          // Second on a phone: the name introduces the picture rather than
          // the picture arriving unattributed. Still held to roughly half the
          // screen so the index and both buttons are reachable without a
          // scroll. On the right and full height from `lg`, spanning both
          // text rows.
          className="relative order-2 h-[55dvh] w-full lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-full lg:w-auto lg:aspect-[4/5]"
          style={{ backgroundColor: current.frame.color }}
        >
          {/* Frames are crossfaded rather than swapped, so a switch never
              shows a gap — but only the incoming and outgoing ones are
              mounted, so first paint costs one photograph instead of five.
              Only the first is `priority`; the rest load at normal priority
              as the cycle reaches them. */}
          {slides.map((discipline, i) =>
            i === slide.active || i === slide.previous ? (
            <Image
              key={discipline.slug}
              src={discipline.frame.src}
              alt={
                i === active
                  ? discipline.frame.alt || `${discipline.name} work by Julian Gigola`
                  : ""
              }
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              priority={i === 0}
              aria-hidden={i === active ? undefined : true}
              className={cn(
                // `cover` against a column already cut to the frame's ratio:
                // fills it with no border of empty colour showing.
                "object-cover transition-opacity duration-500 ease-[var(--ease-out-strong)]",
                "motion-reduce:transition-none",
                i === active ? "opacity-100" : "opacity-0",
              )}
            />
            ) : null,
          )}

          {/* Absent on the intro rather than faded: the credit exists to
              attribute commissioned work, and the city is not any. It arrives
              with the first discipline, under cover of that crossfade — a
              second animation on a corner label would be motion for its own
              sake. */}
          {current.project && (
            <Link
              href={`/work/${current.project.slug}`}
              // Credits the frame on screen, so the cover is attributable
              // rather than anonymous decoration — and gives someone who likes
              // it somewhere to go straight away.
              className="label absolute bottom-4 right-4 z-10 bg-background/70 px-3 py-2 text-muted-foreground backdrop-blur-sm transition-colors duration-200 hoverable:hover:text-foreground sm:bottom-6 sm:right-6"
            >
              {current.project.name} &rarr;
            </Link>
          )}
        </div>

        {/* First on a phone, and the top of the left column from `lg`. */}
        <div className="order-1 flex min-w-0 flex-col lg:col-start-1 lg:row-start-1">
          {/* One: the standing details, as a running head. The tall top
              padding on desktop clears the fixed header so the nav never
              crowds the rule. */}
          {/* `pt-24` on a phone, not `pt-10`: this is now the first thing in
              the section rather than something sitting under a half-screen
              photograph, so it has to clear the fixed header itself — which
              is ~66px of wordmark and padding, and was printing straight
              through "SF BAY AREA" until it did. */}
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border px-6 pb-5 pt-24 sm:px-10 lg:pt-32">
            {/* Held back while the intro is up, because the intro is already
                saying these exact words in display type eighty pixels below.
                Printing them twice at once is the small-scale version of what
                the comment on the masthead warns about.

                Faded rather than unmounted: the rule and the flush-right
                `SF Bay Area` must not move when it arrives. */}
            <p
              className={cn(
                "label text-muted-foreground transition-opacity duration-500 ease-[var(--ease-out-strong)] motion-reduce:transition-none",
                active === 0 ? "opacity-0" : "opacity-100",
              )}
            >
              Photographer &amp; creative director
            </p>
            {/* `ml-auto` rather than `justify-between`, so when the column is
                too narrow for both — which it is at exactly the `lg`
                breakpoint — this drops to its own line and stays flush right
                instead of the left label wrapping under a stranded item. */}
            <p className="label ml-auto shrink-0 text-muted-foreground">SF Bay Area</p>
          </div>

          {/* Two: the masthead, set once. The header's wordmark holds back on
              this route until this has scrolled away — printing the name
              twice, forty pixels apart, is what made an earlier version of
              this page look amateur. */}
          <h1 className="px-6 pt-8 sm:px-10 sm:pt-10">
            {/* Tagged so the header can measure it. The header's own wordmark
                waits on this one and then takes over from where it left, and
                it can only time that against the real element — the masthead's
                size is a `clamp()` on the viewport and its position moves with
                the running head above it. */}
            <span data-masthead className="display block">
              Julian Gigola
            </span>

            {/* The switching half: the job title first, then each discipline.
                Deliberately not a live region — it would announce a new line
                every four seconds, which is noise rather than information.
                Nothing is lost by hiding it: the title is real text in the
                running head above and every discipline is a real link
                immediately below, which is the accessible version of the same
                content. */}
            {/* Two lines of height, always. "Photographer & creative
                director" wraps to two at every width except ~768 and a wide
                desktop column; every discipline is one word on one line. Left
                to itself the block shrinks by a line the moment the intro
                hands off, and the index and both buttons jump up with it —
                3.5s after load, which is exactly when somebody is reading
                them. `leading-none` makes a line exactly `1em`, so `2em` is
                two of them and nothing has to be measured. */}
            <span
              aria-hidden
              className="font-display mt-2 block min-h-[2em] text-3xl uppercase leading-none tracking-[0.02em] text-muted-foreground sm:mt-3 sm:text-4xl"
            >
              {current.name}
            </span>
          </h1>

        </div>

        {/* Last on a phone, so the index and both buttons follow the
            photograph rather than pushing it off the screen. The bottom of
            the left column from `lg`, taking the `1fr` row so the buttons
            still sit against the foot of the picture. */}
        <div className="order-3 flex min-w-0 flex-col lg:col-start-1 lg:row-start-2">
          {/* Three: the index. This is the switcher's control and the site's
              discipline navigation at the same time — hover previews, click
              opens that discipline's own page. Numbering is what keeps it an
              index rather than a row of buttons. */}
          {/* One delegated handler on the list rather than an
              `onPointerEnter` per row.
              `pointerenter` does not bubble — React synthesises it from
              `pointerover`, and that synthesis did not fire reliably here
              either on the `Link` (which consumes pointer events of its own
              for prefetching) or on the row. `pointerover` and `focusin` do
              bubble, so a single listener on the list is both simpler and
              actually dependable. The row index rides on a data attribute
              instead of being captured in four closures. */}
          <nav aria-label="Disciplines" className="mt-8 border-t border-border sm:mt-10">
            <ul onPointerOver={takeFromEvent} onFocus={takeFromEvent}>
              {disciplines.map((discipline, i) => (
                // Offset by one: this list is the disciplines, the cycle is
                // the intro plus the disciplines. Row `i` is slide `i + 1`,
                // and while the intro is up no row is current — which is the
                // honest reading, since the frame on screen is not one of
                // these.
                <li
                  key={discipline.slug}
                  className="border-b border-border"
                  data-discipline={i + 1}
                >
                  <Link
                    href={discipline.href}
                    aria-current={i + 1 === active ? "true" : undefined}
                    className={cn(
                      "group flex items-baseline gap-4 px-6 py-4 transition-colors duration-300 sm:px-10",
                      // `bg-secondary`, not `bg-card`. Card sits at L* 5.7
                      // against a ground of L* 2.8 — a real step in the token
                      // scale, and almost invisible as a band across a row.
                      // This is the one place on the site where a surface has
                      // to be legible as "this is the selected one" from
                      // across the room, so it takes the next step up.
                      i + 1 === active ? "bg-secondary" : "hoverable:hover:bg-card",
                    )}
                  >
                    <span className="label shrink-0 tabular-nums text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "font-display text-xl uppercase leading-none tracking-[0.02em] transition-colors duration-300 sm:text-2xl",
                        i + 1 === active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {discipline.name}
                    </span>
                    <span className="label ml-auto shrink-0 tabular-nums text-muted-foreground">
                      {discipline.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Four: the two ways in, pinned to the foot of the column so the
              type block is anchored at both ends against the full height of
              the picture rather than drifting in the middle. */}
          <div className="mt-auto flex flex-wrap items-center gap-3 px-6 py-8 sm:px-10 sm:py-10">
            <Link
              href="/work"
              className="label border border-foreground bg-foreground px-6 py-4 text-background press hoverable:hover:opacity-90 active:scale-[0.98]"
            >
              See the work
            </Link>
            <Link
              href="/sessions"
              className="label border border-border px-6 py-4 press hoverable:hover:bg-card active:scale-[0.98]"
            >
              Book a session
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
