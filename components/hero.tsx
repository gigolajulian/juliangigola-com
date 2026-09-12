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
 * How long the title card holds before the cover starts cycling.
 *
 * Longer than a `DWELL_MS` lap, because the first one is not like the others:
 * the page is still arriving over the first second — the running head, the
 * name, the index and the buttons each land a beat apart — and a discipline
 * swap landing on top of that reads as one more thing moving rather than as
 * the cover starting. This is the pause between the page settling and the
 * cover beginning to speak.
 */
const INTRO_MS = 5200;

/**
 * The staggered arrival of the type, as a style object.
 *
 * A custom property rather than four utilities: `rise` and `emerge` both read
 * `--reveal-delay`, so the order of the load is stated here as four numbers
 * instead of spread across a stylesheet. The steps are 100ms, which is enough
 * to read as a sequence and short enough that the whole cover is settled
 * inside a second.
 *
 * The photograph is deliberately absent. It is the page's largest paint, and
 * an element at `opacity: 0` is not painted at all — animating it in would
 * hand the browser a worse LCP in exchange for an effect that happens before
 * anybody is looking.
 */
const lands = (ms: number) =>
  ({ "--reveal-delay": `${ms}ms` }) as React.CSSProperties;

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

  /** Whether the cover has yet to make its first move. */
  const opening = React.useRef(true);

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

    // A chain of timeouts rather than an interval, so the first lap can be
    // longer than the rest. An interval cannot vary its own period, and
    // reading `active` to decide would put it in this effect's dependencies
    // and restart the timer on every switch.
    let id = 0;
    const advance = () => {
      setSlide((s) => ({
        // Wraps to 1, not 0. The intro plays once and is then out of the
        // rotation for the life of the page.
        active: s.active + 1 >= slides.length ? 1 : s.active + 1,
        previous: s.active,
      }));
      id = window.setTimeout(advance, DWELL_MS);
    };

    // Only the very first run waits out the load; picking the cover back up
    // after a hover should not sit there for five seconds.
    id = window.setTimeout(advance, opening.current ? INTRO_MS : DWELL_MS);
    opening.current = false;

    return () => window.clearTimeout(id);
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
        if (sectionRef.current?.contains(document.activeElement))
          return rearm();
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
    const row = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-discipline]",
    );
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
      {/* `min-h-dvh`, not `h-dvh`. The type column needs ~930px at its widest
          setting, so on a viewport shorter than that — 860px is a 13" laptop
          with a browser bar — a fixed height left the two buttons hanging
          below the cover and overlapping the press strip. A minimum fills the
          screen on every normal display and lets the section grow rather than
          spill on a short one. It stays a single implicit row, which is what
          keeps the row height definite enough for the picture's `h-full` to
          resolve against. */}
      <div className="flex flex-col lg:grid lg:min-h-dvh lg:grid-cols-[1fr_80dvh]">
        {/* The photograph leads on a phone — it is the hook — but it is held
            to half the screen so the name and both ways in stay visible
            without scrolling. */}
        <div
          // Second on a phone: the name introduces the picture rather than
          // the picture arriving unattributed. Still held to roughly half the
          // screen so the index and both buttons are reachable without a
          // scroll. On the right and full height from `lg`, spanning both
          // text rows.
          // Second on a phone: the name introduces the picture rather than
          // the picture arriving unattributed. Still held to roughly half the
          // screen so the index and both buttons are reachable without a
          // scroll. On the right and full height from `lg`.
          //
          // No width, height or aspect of its own above `lg` — all three are
          // the column's job now, and giving the picture any of them is what
          // kept breaking this.
          //
          // The 4:5 column used to come from `aspect-[4/5]` on the picture
          // with an `auto` track beside it, which is circular: the height
          // came from the width, the width came from the track, and the track
          // came from the picture. Whenever the type column grew past one
          // screen the loop resolved 70px too tall and the cover overflowed
          // its own section into the press strip below.
          //
          // The track is now `80dvh` — 4:5 of a full-height column, stated in
          // viewport units so it depends on nothing. The picture simply
          // stretches to its row.
          className="relative order-2 h-[55dvh] w-full lg:order-last lg:h-auto"
          style={{ backgroundColor: current.frame.color }}
        >
          {/* One frame dissolves up over the one it replaces.
           *
           * Two things were wrong with fading them against each other. Both
           * layers transitioned at once, so halfway through a switch each sat
           * near 50% and the mat colour showed between them — every change
           * dipped through a wash before recovering. And nothing set a stacking
           * order, so paint order followed this array: moving *down* the index
           * put the incoming frame on top, moving *up* put the outgoing one on
           * top instead, and the same interaction looked like two different
           * effects depending on which way the pointer travelled.
           *
           * Now only the incoming layer animates, and it is explicitly above
           * the outgoing one. The frame being replaced stays fully opaque
           * underneath until it is covered, so there is nothing to see through.
           *
           * Still only two are ever mounted, so first paint costs one
           * photograph rather than six. */}
          {slides.map((discipline, i) =>
            i === slide.active || i === slide.previous ? (
              <Image
                key={discipline.slug}
                src={discipline.frame.src}
                alt={
                  i === active
                    ? discipline.frame.alt ||
                      `${discipline.name} work by Julian Gigola`
                    : ""
                }
                fill
                sizes="(min-width: 1024px) 45vw, 100vw"
                priority={i === 0}
                aria-hidden={i === active ? undefined : true}
                className={cn(
                  // `cover` against a column already cut to the frame's ratio:
                  // fills it with no border of empty colour showing.
                  "object-cover",
                  // Incoming above outgoing, by role rather than by index.
                  i === active ? "z-10" : "z-0",
                  // The very first frame is the page's largest paint; fading it
                  // up from nothing would cost half a second of blank column
                  // for an effect nobody is there to see.
                  i === active && slide.previous !== -1 && "dissolve",
                  // Both fully opaque. The outgoing frame is not faded out —
                  // it is covered. Fading it would be the second half of the
                  // wash this change exists to remove.
                  "opacity-100",
                )}
              />
            ) : null,
          )}

          {/* Absent on the intro rather than faded: the credit exists to
              attribute commissioned work, and the city is not any. It arrives
              with the first discipline, under cover of that crossfade — a
              second animation on a corner label would be motion for its own
              sake. */}
          {/* Credits the frame on screen, so the cover is attributable rather
              than anonymous decoration — and gives someone who likes it
              somewhere to go straight away.

              Mounted in pairs and timed with the title, for the same reason:
              a label that swapped on the tick while the word below was still
              leaving would split one change into two events. The outgoing copy
              is taken out of the tab order and hidden from the reader while it
              fades, so there are never two credits to land on. */}
          {slides.map((discipline, i) => {
            const project = discipline.project;
            if (!project || (i !== active && i !== slide.previous)) return null;
            const leaving = i !== active;
            return (
              <Link
                key={discipline.slug}
                href={`/work/${project.slug}`}
                tabIndex={leaving ? -1 : undefined}
                aria-hidden={leaving || undefined}
                className={cn(
                  "label absolute bottom-4 right-4 z-10 bg-background/70 px-3 py-2 text-muted-foreground backdrop-blur-sm hoverable:hover:text-foreground sm:bottom-6 sm:right-6",
                  leaving
                    ? "title-out pointer-events-none"
                    : // Same guard as the photograph: on the intro there is no
                      // outgoing phase, and fading the label up on first paint
                      // would be an entry animation on a cover that is not
                      // supposed to have one.
                      slide.previous !== -1 && "title-in",
                )}
              >
                {project.name} &rarr;
              </Link>
            );
          })}
        </div>

        {/* `display: contents` on a phone, a real column from `lg`.
         *
         * The two halves of the type have to be separable on a phone — the
         * name above the photograph, the index and buttons below it — and
         * inseparable above `lg`, where they are one column beside it.
         * `contents` gives both: the wrapper vanishes from the layout on a
         * phone, so its children become items of the outer flex column and
         * `order` interleaves them with the picture; from `lg` it becomes the
         * column it looks like, and the grid is back to the single full-height
         * row that made the cover fit the screen in the first place.
         */}
        <div className="contents lg:flex lg:min-w-0 lg:flex-col">
          {/* First on a phone, and the top of the left column from `lg`. */}
          <div className="order-1 flex min-w-0 flex-col">
            {/* One: the standing details, as a running head. The tall top
              padding on desktop clears the fixed header so the nav never
              crowds the rule. */}
            {/* `pt-24` on a phone, not `pt-10`: this is now the first thing in
              the section rather than something sitting under a half-screen
              photograph, so it has to clear the fixed header itself — which
              is ~66px of wordmark and padding, and was printing straight
              through "SF BAY AREA" until it did. */}
            <div
              style={lands(120)}
              className="rise flex flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border px-6 pb-5 pt-24 sm:px-10 lg:pt-32"
            >
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
              <p className="label ml-auto shrink-0 text-muted-foreground">
                SF Bay Area
              </p>
            </div>

            {/* Two: the masthead, set once. The header's wordmark holds back on
              this route until this has scrolled away — printing the name
              twice, forty pixels apart, is what made an earlier version of
              this page look amateur. */}
            <h1 style={lands(220)} className="emerge px-6 pt-8 sm:px-10 sm:pt-10">
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
              {/* Both words are mounted through the swap, the same way the
                  picture mounts its outgoing and incoming frames — because a
                  word that is unmounted the instant the phase ticks cannot be
                  animated out at all, and half of this transition is the
                  leaving. React keeps each node across the change by slug, so
                  the one that was current simply changes class and transitions
                  where it stands.

                  Stacked rather than in flow: the box is already a fixed two
                  lines, so absolute children fill it without either word
                  moving the index and buttons below. See `title-out` and
                  `title-in` in `globals.css` for the timings — the outgoing
                  word is gone before the incoming one starts, so the two names
                  are never both legible. */}
              <span
                aria-hidden
                className="relative mt-2 block min-h-[2em] sm:mt-3"
              >
                {slides.map((discipline, i) =>
                  i === active || i === slide.previous ? (
                    <span
                      key={discipline.slug}
                      className={cn(
                        "font-display absolute inset-0 text-3xl uppercase leading-none tracking-[0.02em] text-muted-foreground sm:text-4xl",
                        i === active
                          ? // On the intro there is no outgoing word and
                            // nothing to wait for, so the first title is
                            // simply there — the cover still has no entry
                            // animation of its own.
                            slide.previous !== -1 && "title-in"
                          : "title-out",
                      )}
                    >
                      {discipline.name}
                    </span>
                  ) : null,
                )}
              </span>
            </h1>
          </div>

          {/* Last on a phone, so the index and both buttons follow the
            photograph rather than pushing it off the screen. `flex-1` from
            `lg` so it takes the rest of the column and the `mt-auto` on the
            buttons still pins them to the foot of the picture. */}
          <div className="order-3 flex min-w-0 flex-col lg:flex-1">
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
            <nav
              aria-label="Disciplines"
              style={lands(320)}
              className="rise mt-8 border-t border-border sm:mt-10"
            >
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
                        i + 1 === active
                          ? "bg-secondary"
                          : "hoverable:hover:bg-card",
                      )}
                    >
                      <span className="label shrink-0 tabular-nums text-muted-foreground">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "font-display text-xl uppercase leading-none tracking-[0.02em] transition-colors duration-300 sm:text-2xl",
                          i + 1 === active
                            ? "text-foreground"
                            : "text-muted-foreground",
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
            <div
              style={lands(420)}
              className="rise mt-auto flex flex-wrap items-center gap-3 px-6 py-8 sm:px-10 sm:py-10"
            >
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
      </div>
    </section>
  );
}
