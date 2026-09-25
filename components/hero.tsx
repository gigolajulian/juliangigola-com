"use client";

import * as React from "react";
import BLUR from "@/public/hero/blur.json";
import Link from "next/link";
import Image, { getImageProps } from "next/image";
import { cn } from "@/lib/utils";
import type { Discipline, Frame } from "@/lib/work";

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

/** The cover's slot, shared by the pictures and the warm-up below. */
const COVER_SIZES = "(min-width: 1024px) 45vw, 100vw";

/**
 * A frame fetched and decoded ahead of its turn, once per visit.
 *
 * Only two frames are mounted (see `slide`), so the next one used to be
 * asked for at the moment it was due: measured on production, the first
 * switch dissolved in over a block of colour and the photograph landed
 * 5.8s after load. Built from `getImageProps` with the same `sizes`, so
 * the browser picks the same candidate the mounted picture will and the
 * switch finds it in the cache, already decoded.
 */
const warmed = new Map<string, Promise<void>>();
const warmFrame = (src: string) => {
  let done = warmed.get(src);
  if (!done) {
    const { props } = getImageProps({ src, alt: "", fill: true, sizes: COVER_SIZES });
    const img = new window.Image();
    if (props.sizes) img.sizes = props.sizes;
    if (props.srcSet) img.srcset = props.srcSet;
    img.src = props.src;
    done = img.decode().catch(() => {});
    warmed.set(src, done);
  }
  return done;
};

/**
 * The two ways in.
 *
 * The site's own two buttons (`action` and `action-quiet` in `globals.css`),
 * which are the work index's filter chip at button size: ink on paper for
 * the first, a hairline for the second. Julian: the CTA buttons did not
 * match the website design.
 *
 * The one thing added here that the same pair on a page does not need: the
 * quiet button takes a paper ground. Everywhere else it sits on the page and
 * a hairline round nothing is enough; here it sits on a photograph, and a
 * hairline round a photograph is a window, not a button.
 *
 * Mounted twice, the way the disciplines are: a list of rows and a strip of
 * ticks. From `wide` these sit over the foot of the photograph, bottom
 * right, which is a place the plate cannot reach — it blurs its ground, and
 * an element with a backdrop filter is the containing block for anything
 * absolute inside it, so a button in the plate can only ever reach the
 * plate's own corner. The copy that floats is a child of the type column
 * instead, which spans the whole section.
 *
 * The other copy stays in the plate, under the name, for the two layouts
 * where the photograph is the whole canvas rather than a column beside the
 * type: floating over the far right of a full-bleed frame there would put
 * them across the picture and on top of the frame's credit.
 */
function Ways({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn("flex flex-wrap items-center gap-3", className)}
    >
      <Link
        href="/work"
        className="label action px-7 py-5 press active:scale-[0.97] max-sm:px-4 short:px-6 short:py-3.5"
      >
        See the work
      </Link>
      <Link
        href="/sessions"
        className="label action-quiet px-7 py-5 press active:scale-[0.97] max-sm:px-4 short:px-6 short:py-3.5"
      >
        Book a session
      </Link>
    </div>
  );
}

/** The inlined blur-up for a hand-made hero frame, if it has one. */
const blurFor = (src: string): string | undefined =>
  (BLUR as Record<string, string>)[src];

/**
 * The staggered arrival of the type, as a style object.
 *
 * A custom property rather than a utility per step: `rise` and `emerge` both
 * read `--reveal-delay`, so the order of the load is stated here as numbers
 * instead of spread across a stylesheet.
 *
 * These used to run 120-420ms and were all but invisible, for a reason that
 * is only obvious once measured: `<main>` carries `rise` too, so the whole
 * page fades as one slab from 0ms over 420ms — and every one of those delays
 * fell inside that window. The cascade was happening underneath a blanket
 * fade of itself.
 *
 * So it starts where the slab finishes. The photograph is in that slab and
 * arrives with it, which is the right order anyway: the picture is what the
 * page is, and the type introduces it rather than racing it.
 *
 * The index cascades row by row rather than arriving as a block — seven rows
 * at 55ms is the one place here where a stagger reads as deliberate instead
 * of as lag, because they are identical objects in a list and the eye follows
 * them down.
 */
/** Where the page's own slab fade has finished and the cover can begin. */
const HEAD_MS = 480;
const NAME_MS = 600;
/* The buttons sit under the name now rather than under the index, so they
   land there too: third, and before the rows below them. A button arriving
   above seven rows that are already on the page reads as one that was
   forgotten, whatever the timing says. */
const BUTTONS_MS = 720;
const INDEX_MS = 840;
/** Between one index row and the next. */
const ROW_MS = 55;

/**
 * The swap, at the speed a hover deserves.
 *
 * The automatic cycle hands off slowly and on purpose: the outgoing word
 * clears the frame before the incoming one starts, which is why the arriving
 * title waits 360ms and then takes 320. Nobody is waiting on it — the cover
 * is talking to itself.
 *
 * A hover is the opposite. It is direct manipulation: the visitor is pointing
 * at a row and expecting that row, and most of a second before the word has
 * finished arriving reads as the page thinking about it. So while they have
 * hold of the index the handoff is compressed to about 270ms and the picture
 * with it — the same choreography, out still clearing before in arrives, at
 * the speed of an answer rather than a performance. The frame's flash is not
 * in here: it is a fixed 250ms either way, because a shutter does not have
 * two speeds (`dissolve` in `globals.css`).
 *
 * Set on the section, so one declaration reaches the word, the credit in the
 * far corner and the photograph, none of which share a parent below it.
 */
const HURRIED = {
  "--swap-out-delay": "0ms",
  "--swap-out-dur": "120ms",
  "--swap-in-delay": "90ms",
  "--swap-in-dur": "180ms",
  "--swap-pic-dur": "260ms",
} as React.CSSProperties;

const lands = (ms: number) =>
  ({ "--reveal-delay": `${ms}ms` }) as React.CSSProperties;

/**
 * Whether the cover is being come back to.
 *
 * The cascade above is a first impression: the photograph, then the name,
 * then the buttons and seven rows one beat apart, most of two seconds. On
 * the fifth trip home it read as the site loading, and Julian asked for a
 * better arrival. So the cascade runs once, on a cold load, and a return
 * lands as one: every delay is zero and the parts fade up together with
 * the page's own settle, half a second from the press.
 *
 * `page-transition.tsx` writes `data-nav` on the root for the length of a
 * client-side trip, which is the only way this component ever mounts
 * without a cold load. Read once, at mount: on the server and on a
 * hydration the attribute is absent, so the two renders agree.
 */
const returning = () =>
  typeof document !== "undefined" &&
  document.documentElement.dataset.nav !== undefined;

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
type Slide = {
  slug: string;
  name: string;
  frame: Frame;
  /** What the frame is and where it goes. The intro card credits nothing. */
  credit?: { name: string; href: string };
};

export function Hero({
  disciplines,
  className,
}: {
  disciplines: Discipline[];
  /** The cover is the first cell of the homepage's strip, and the cell is
      given its width and its height by the page. See `app/page.tsx`. */
  className?: string;
}) {
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
  const [back] = React.useState(returning);
  /** Where each part of the cover lands: the cascade, or all at once. */
  const at = (ms: number) => lands(back ? 0 : ms);
  const { active } = slide;
  /** For the timer, which reads it without restarting on every switch. */
  const activeRef = React.useRef(active);
  React.useEffect(() => {
    activeRef.current = active;
  }, [active]);

  /* The rest of the frames, one at a time and in the order they play,
     once the page has loaded: never competing with the first picture,
     and there before a hover asks for one. */
  React.useEffect(() => {
    let live = true;
    const run = async () => {
      for (const s of slides.slice(1)) {
        if (!live) return;
        await warmFrame(s.frame.src);
      }
    };
    if (document.readyState === "complete") void run();
    else window.addEventListener("load", () => void run(), { once: true });
    return () => {
      live = false;
    };
    // The slides are fixed for the life of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Tells the header there is a photograph behind it.
   *
   * Presence, not brightness. The first version of this published how light
   * the frame was, from the mean colour the harvester records, so the bar
   * could ink itself dark over a pale cover. It picked wrong on the first
   * frame I checked: CYBER1A's mean is dark, because the outfit is black, and
   * the part the bar actually sits on is a pale studio backdrop. A mean
   * describes the whole picture and the bar occupies one corner of it.
   *
   * Sampling that corner properly means a canvas read per frame, and it would
   * still have nothing to say about a frame that is pale on the left and black
   * on the right. Which is the argument already made for putting the hero type
   * on a plate — so the bar gets the same plate, and needs to know only that
   * there is something behind it worth covering.
   *
   * An attribute on the document rather than a prop, because the header is a
   * sibling in the root layout and not this component's child. Removed on
   * unmount, so a route with no cover is not left plated over nothing.
   */
  React.useEffect(() => {
    document.documentElement.dataset.cover = "true";
    return () => {
      delete document.documentElement.dataset.cover;
    };
  }, []);

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
   * COVER ART and the page simply stopped there, with every other discipline
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
    let live = true;
    const advance = () => {
      // Wraps to 1, not 0. The intro plays once and is then out of the
      // rotation for the life of the page.
      const now = activeRef.current;
      const next = now + 1 >= slides.length ? 1 : now + 1;
      // Not before the next frame is in hand: a dissolve over a picture
      // still in flight is a block of colour and then a pop.
      void warmFrame(slides[next].frame.src).then(() => {
        if (!live) return;
        setSlide((s) => ({ active: next, previous: s.active }));
        id = window.setTimeout(advance, DWELL_MS);
      });
    };

    // Only the very first run waits out the load; picking the cover back up
    // after a hover should not sit there for five seconds.
    id = window.setTimeout(advance, opening.current ? INTRO_MS : DWELL_MS);
    opening.current = false;

    return () => {
      live = false;
      window.clearTimeout(id);
    };
    // `slides` is rebuilt every render from props that never change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* A mouse only. `pointerover` fires for a finger too, and on a tablet
     the home page is a strip you swipe: a finger crossing the discipline
     rows on its way through fired this at every row it passed and the
     cover changed two or three times under the hand mid-swipe, which is
     the glitch Julian was looking at. A deliberate press still chooses a
     row, through the click below, and a keyboard still chooses one
     through focus. */
  const takeFromHover = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    takeFromEvent(e);
  };

  const current = slides[active];
  if (!current) return null;

  return (
    <section
      ref={sectionRef}
      // The first cell of the homepage's strip: it gets a tick like the
      // rest, and `/#cover` is a link back to it.
      data-tick
      data-label="Cover"
      data-hash="cover"
      // `held` is set in the same handler as the slide change, so the
      // arriving word mounts with these already in place rather than a
      // render late.
      style={held ? HURRIED : undefined}
      className={cn(
        className,
        /* The height is the cell's, and the cell is the strip's: the cover
           is exactly the screen less the footer's line on a wide screen,
           and a screen of its own where the page stacks. One place decides
           it, in `app/page.tsx`, rather than three viewport units here. */
        "relative flex h-full flex-col border-b border-border",
        /* The masthead is `clamp(2.75rem, 8vw, 7rem)`, which is right when
           the type has the window - stacked, or in `wide`'s panel, which
           grows with it. The squarish panel does not grow: it is clamped at
           40rem, and 8vw of a 2000px screen is 160px of Univers Bold
           Condensed in a 640px column. Re-declared here rather than at the
           masthead, because custom properties inherit and one declaration on
           the section reaches the word wherever it is set. */
        /* How much of a wide screen the photograph takes. Julian asked to
           see more of the picture: it was `80dvh` across, which is 4:5 at
           full height and so the frame entire — and exactly half of a
           1440px window spent on a panel whose masthead wraps at 358px and
           whose index rows end 200px short of their own right edge. The
           picture is exactly 4:5 of its own height now, which is the one
           width at which nothing is cropped: the frames are upright and
           any share of the window wider than four fifths of the height
           eats the top and the bottom of them. Every guess before this
           was a share of the width — 80dvh, then 62%, then 54% — and a
           share of the width is only ever right at one window shape,
           worst on the big screens where the height is the thing that
           grew. The cover cell is its own size container so the picture
           can read the height it actually has: `dvh` is the window, and
           the cell is the window less the footer's line. */
        "wide:[container-type:size] wide:[--cover-picture:calc(100cqh*4/5)]",
        "squat:[--text-display:clamp(2.5rem,4vw,5rem)]",
        /* And down again on a short window, whatever its shape. A laptop at
           1280x700 and an iPad held sideways both give the cover about 600px
           of height, and the name at 8vw of a 1200px window is 95px a line:
           two lines of it, a discipline word under them and a seven row
           index do not fit in that, so the index was showing three and a
           half rows with the fourth cut through the middle. */
        "short:[--text-display:clamp(2.25rem,4.5vw,4.5rem)]",
      )}
    >
      {/* The photograph is the whole canvas now, with the type on top of it.
       *
       * It used to be a column beside the type — `1fr` of words against
       * `80dvh` of picture, which is 4:5 at full height so nothing was ever
       * cropped. That held the frame intact and spent half the screen on a
       * panel, and at some window shapes the two collided: the discipline
       * word was clipped by the picture's own edge.
       *
       * Full bleed crops, and that is the trade taken deliberately. A 4:5
       * frame on a 16:9 screen loses roughly a third, top and bottom, from
       * the centre — so a frame chosen for the cover now wants headroom in
       * it. `COVER_OVERRIDES` and the discipline covers in /admin are where
       * that choice gets made.
       */}
      <div
        className={cn(
          "absolute inset-0 overflow-hidden",
          /* Full bleed on every layout, including upright screens: the
             plate at the foot is a band there now (see below), so the
             photograph has the screen. */

          // From `wide`, it stops being the whole canvas and becomes the
          // right-hand column again: `80dvh` across is 4:5 at full height, so
          // the frame is shown entire rather than cropped to the window. The
          // type has the rest.
          "wide:left-auto wide:right-0 wide:w-[var(--cover-picture)]",
        )}
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
              sizes={COVER_SIZES}
              priority={i === 0}
              fetchPriority={i === 0 ? "high" : undefined}
              // A 16px copy of the frame, inlined, under the picture while it
              // loads — so the cover is never a flat block of the frame's
              // colour. Only the hand-made frames in `/hero/` have one
              // (`scripts/make-hero.mjs`); the archive's arrive under a
              // crossfade and can wait for Cloudflare's resizer.
              placeholder={blurFor(discipline.frame.src) ? "blur" : "empty"}
              blurDataURL={blurFor(discipline.frame.src)}
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
                // No `opacity-100` here, and that matters: it used to be,
                // to say "both layers are fully opaque — the outgoing frame
                // is covered, not faded". The intent was right and the
                // implementation cancelled the transition it sat next to.
                //
                // `opacity-100` declares `opacity: 1` unconditionally, which
                // beats `dissolve`'s `@starting-style` in the cascade
                // whatever order the classes are written in. So the incoming
                // frame began at full opacity and there was no crossfade at
                // all — the pictures hard-cut, and only the mat colour and
                // the type ever moved.
                //
                // The outgoing layer needs no declaration to stay opaque: it
                // carries no `dissolve`, so its opacity is already 1. Saying
                // so out loud is what broke it.
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
          const credit = discipline.credit;
          if (!credit || (i !== active && i !== slide.previous)) return null;
          const leaving = i !== active;
          return (
            <Link
              key={discipline.slug}
              href={credit.href}
              tabIndex={leaving ? -1 : undefined}
              aria-hidden={leaving || undefined}
              className={cn(
                /* Bottom right of the frame, except from `wide`, where the
                   two buttons have that corner: there it takes the other
                   one. The picture is its own column at that width, so its
                   left edge is the panel's border and the pill sits on the
                   frame either way. */
                "label glass absolute bottom-4 right-4 z-10 px-4 py-2.5 text-muted-foreground hoverable:hover:text-foreground sm:bottom-6 sm:right-6 wide:left-10 wide:right-auto",
                leaving
                  ? "title-out pointer-events-none"
                  : // Same guard as the photograph: on the intro there is no
                    // outgoing phase, and fading the label up on first paint
                    // would be an entry animation on a cover that is not
                    // supposed to have one.
                    slide.previous !== -1 && "title-in",
              )}
            >
              {credit.name} &rarr;
            </Link>
          );
        })}
      </div>

      {/* The type: beside the picture where there is room, over it where
       * there is not.
       *
       * The same material as the bar at the top of every page and the cards
       * on the homepage, thinned down: the ground at 45% rather than 70%, so
       * more of the photograph comes through, with the blur taken up a step
       * to hold the type legible against the extra detail now showing behind
       * it. Transparency and blur trade against each other — dropping the
       * ground without deepening the blur is how type over a picture becomes
       * a texture. Closed with a hairline. It is the site's one established translucent surface, so it
       * reads as chrome over the photograph rather than as damage to it — and
       * unlike flipping the ink, it is legible on a frame that is pale in one
       * corner and black in another, which most of these are.
       *
       * A band across the foot on a phone, a full-height column on the left
       * from `lg`. Either way the picture is behind all of it and none of the
       * type is closer to the photograph than the plate's own padding.
       */}
      {/* The column is layout, not a surface: `pointer-events-none` so the
          picture's empty acres pass a press through to what is under them,
          which is how the credit pill in the corner gets clicked at all. It
          used to sit under this column and take nothing. Julian: when the
          pill is clicked, open the project. The plate takes them back. */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col justify-end squat:justify-start wide:justify-start">
        {/* Bottom right of the cover, over the foot of the photograph.

            Its own box rather than the corner of this column, which is the
            whole cell and would put the buttons under whatever the column
            is holding. `pointer-events-auto` on the buttons because
            everything around them passes presses through to the picture. */}
        {/* Off the picture on a short window: at 1194 by 724 the picture
            column is 579 wide and the two buttons and the frame's credit
            pill both want that foot, so the pill ran under the first
            button. The panel's own copy takes over. */}
        <div className="pointer-events-none absolute inset-0 hidden wide:block short:wide:hidden">
          <Ways
            style={at(BUTTONS_MS)}
            className="rise pointer-events-auto absolute bottom-6 right-6 z-20 sm:bottom-8 sm:right-10"
          />
        </div>

        <div
          className={cn(
            "pointer-events-auto flex min-w-0 flex-col",
            // Over the photograph: thinned ground, deep blur.
            "glass-surface bg-background/45",
            /* Upright screens — a phone, a tablet held tall — asked for the
               picture: "show the images … with julian gigola on the bottom
               fourth and the phases". So the photograph is the whole screen
               and this plate is a band at its foot: the running head, the
               name with the phase under it, a strip of seven ticks for the
               phases, and the two buttons. The seven-row index that made the
               plate 555px tall is off here (see the nav below): on a phone
               the ticks are the same control at a thumb's size, and a tablet
               held upright has the buttons only. It had the rows for three
               days and they cost it the picture — measured at 768 by 1024
               the plate covered 80% of the cover. Denser ground than the
               stacked default so the type holds on a bright frame. */
            /* Julian: thirty per cent less of it on a phone. 72 down to
               50, so more of the photograph comes through the band under
               it — the name and the phase are display weight over a deep
               blur and hold at that. */
            "tall:bg-background/[0.5]",
            /* Less thin and less blurred where the panel is a full column.

               At 45% over a 40px blur the panel became a smear rather than a
               surface: on a pale frame the ground goes near-white, the muted
               type in the index drops to a contrast nobody can read, and the
               photograph behind is unrecognisable — so it is neither legible
               chrome nor a visible picture. The stacked layout is a band at
               the foot of a screen and gets away with it; a column running
               the full height does not.

               72% and 24px keeps what Julian asked for — the picture reads
               through it — while giving the type a ground it can sit on. */
            "squat:bg-background/[0.72]",
            /* Squarish: a column like the one beside it in `wide`, but in
               the ground of the one below — full height down the left, with
               the photograph full bleed and entire behind it rather than
               cropped to a band above it.

               The width is clamped rather than a share of the window. `42%`
               of a 2000px screen is 840px of panel for a masthead that wants
               480, and the picture pays the difference; the floor stops that
               same panel collapsing under the masthead at 1024px, which is
               where this layout starts.

               `justify-center`, because a window in this band can be far
               taller than it is wide and a block stretched top-to-bottom
               leaves a hole in the middle of itself. Centred, the head, the
               name, the index and the buttons read as one block with the
               panel around them. */
            "squat:h-full squat:w-[clamp(28rem,42%,40rem)] squat:justify-center squat:border-r squat:border-t-0",
            // Beside it: a real panel, opaque and unblurred, filling the
            // width the picture does not take. Nothing is laid over the
            // frame at this ratio, which is the design Julian had and asked
            // to keep — the plate is what the other two fall back to.
            "wide:h-full wide:w-[calc(100%-var(--cover-picture))] wide:border-r wide:border-t-0",
            "wide:bg-background wide:backdrop-blur-none",
          )}
        >
          {/* First on a phone, and the top of the left column from `lg`. */}
          <div className="flex min-w-0 flex-col">
            {/* One: the standing details, as a running head. The tall top
              padding on desktop clears the fixed header so the nav never
              crowds the rule. */}
            {/* The tall padding is for the two layouts where this block
              starts at the top of the screen, under the fixed bar. In the
              stacked layout the plate sits at the *foot* — measured, its top
              edge is 374px down a 1010px phone — so there is nothing above it
              to clear and the padding would be frosted glass with nothing on
              it.

              `pt-20` on both `squat` and `wide`, from one class so they
              cannot drift apart: the bar is 60px tall since it was made
              compact for a page that no longer scrolls down, and 80px
              clears it with room. (It was 101px and `pt-28`; before that
              `squat` had 96px and put the running head five pixels under
              the bar, which is the bug this line fixed.) */}
            <div
              style={at(HEAD_MS)}
              /* On a short window the two standing lines go and the band
                 keeps only the height the fixed bar needs. They are in the
                 footer of every page and the bar is over them; the rows
                 under the name are what a visitor came to this screen
                 for. */
              className="rise flex flex-wrap items-baseline gap-x-6 gap-y-1 px-6 pb-4 pt-6 max-sm:pb-2 max-sm:pt-3 sm:px-10 sm:pt-8 squat:pt-20 wide:pt-20 short:pb-0 short:[&>*]:hidden"
            >
              {/* Held back while the intro is up, because the intro is already
                saying these exact words in display type eighty pixels below.
                Printing them twice at once is the small-scale version of what
                the comment on the masthead warns about.

                Faded rather than unmounted: the flush-right `SF Bay Area`
                must not move when it arrives. */}
              <p
                className={cn(
                  "label text-muted-foreground transition-opacity duration-500 ease-[var(--ease-out-strong)] motion-reduce:transition-none",
                  /* Not on a phone. The band at the foot is 332 of a 745px
                     screen and this line takes 30 of them to say, in 14px
                     caps, what the display type says 100px below it - and it
                     cannot share a line with `SF Bay Area` in a 345px column,
                     so it costs the row double. The two lines printing the
                     same sentence at two sizes is the crammed feeling
                     itself. */
                  "max-sm:hidden",
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
                San Francisco Bay Area
              </p>
            </div>

            {/* Two: the masthead, set once. The header's wordmark holds back on
              this route until this has scrolled away — printing the name
              twice, forty pixels apart, is what made an earlier version of
              this page look amateur. */}
            <h1
              style={at(NAME_MS)}
              className="emerge px-6 pt-6 [container-type:inline-size] max-sm:pt-3 sm:px-10 squat:pt-10 wide:pt-10"
            >
              {/* The header's own wordmark waits on this one and takes over
                once it has gone by. It used to be measured live from the
                header; the moment is the strip's now, so nothing reads this
                element but the eye. */}
              {/* Capped against the panel as well as the viewport: at 1440x900 the
                left panel is narrower than at 1366, and the name broke onto
                two lines and pushed the index down. */}
              <span
                className="display block"
                style={{ fontSize: "min(var(--text-display), 13.2cqw)" }}
              >
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

                  Indented half a cap width of its own face. Flush with the
                  name, the J of Julian and the first letter of the
                  discipline stack into a single left edge and the word below
                  reads as a second line of the name rather than as a label
                  under it. A full cap was the first pick, then Julian
                  halved it; a full word's indent detached it. `ps` and not `pl` so the absolute children
                  move with it — an absolutely positioned child is laid out
                  against the padding box of this element, so the padding
                  carries them.

                  Stacked rather than in flow: the box is already a fixed two
                  lines, so absolute children fill it without either word
                  moving the index and buttons below. See `title-out` and
                  `title-in` in `globals.css` for the timings — the outgoing
                  word is gone before the incoming one starts, so the two names
                  are never both legible. */}
              <span
                aria-hidden
                className="relative mt-2 block min-h-[2em] text-3xl [container-type:inline-size] max-sm:min-h-[1em] max-sm:text-[min(1.875rem,5.8cqw)] sm:mt-3 sm:text-4xl short:min-h-[1em] short:text-2xl short:sm:text-2xl lying:text-[min(1.5rem,5.8cqw)]"
              >
                {slides.map((discipline, i) =>
                  i === active || i === slide.previous ? (
                    <span
                      key={discipline.slug}
                      className={cn(
                        "font-display absolute inset-y-0 end-0 start-[0.23em] text-3xl uppercase leading-none tracking-[0] text-muted-foreground max-sm:whitespace-nowrap max-sm:text-[min(1.875rem,5.8cqw)] sm:text-4xl short:text-2xl short:sm:text-2xl lying:whitespace-nowrap lying:text-[min(1.5rem,5.8cqw)]",
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

          {/* Last on a phone, so the buttons and the index follow the
            photograph rather than pushing it off the screen.

            `wide:flex-1`, where it used to be `lg:`. It takes the rest of the
            column so the spacer inside it can push the index to the foot of
            the picture — which is the design at `wide` and wrong in the
            squarish band, where a window can be much taller than it is wide.
            Growing there is what defeated `justify-center` on the panel: the
            children already filled it, so there was nothing left to centre
            and the block sat against the top with 350px of panel under it.
            `lg` is a width and could not tell those two cases apart. */}
          <div className="flex min-h-0 min-w-0 flex-col wide:flex-1">
            {/* Two: the ways in, under the name. Where the photograph is
                the whole canvas this is the only copy; from `wide` the one
                over the picture's foot takes over and this one goes. */}
            <Ways
              style={at(BUTTONS_MS)}
              /* Margins, not padding: the block is ink now, and padding on
                 it would be ink around the rows rather than air around the
                 block.

                 Bottom right on an upright tablet. The rows the plate used
                 to hold are gone from there, so the buttons are the last
                 thing in it and the only thing on that line: against the
                 right edge they sit under the thumb that is already there
                 for the menu, and the name keeps the left. Julian asked. */
              className="rise mx-6 mb-2 mt-6 sm:mx-10 sm:mb-4 sm:mt-8 tall:mb-0 tall:mt-5 sm:tall:mb-6 sm:tall:justify-end wide:hidden short:wide:flex short:mb-0 short:mt-4"
            />

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
            {/* Whatever height the panel has spare, this takes, so the
                index and the two buttons under it sit at the foot of the
                left panel rather than packed under the name. Julian: the
                phases feel clustered there, move them to the bottom left.

                A spacer and not `mt-auto` on the index, because an auto
                margin that finds no spare height collapses to nothing and
                the index would end up touching the subtitle on a screen
                where the panel is already full. `basis-0 shrink-0` is a
                box that is either the spare height or zero, never less,
                so the index keeps its own `sm:mt-6` when there is none. */}
            <div
              aria-hidden
              className="hidden basis-0 shrink-0 wide:block wide:grow"
            />

            {/* The cover is a cell of the strip now and the cell is the
                screen less the footer's line, so on a short window the ten
                rows are taller than the panel. The list keeps its size and
                scrolls inside itself rather than losing rows or shrinking
                the type Julian asked to be big: `data-scroll` is the
                strip's own contract — a wheel over this list moves the list
                until it runs out and then moves the strip. */}
            <nav
              data-scroll
              aria-label="Disciplines"
              className="mt-8 min-h-0 overflow-y-auto overscroll-contain border-t border-border sm:mt-6 tall:hidden lying:hidden"
            >
              <ul
                onPointerOver={takeFromHover}
                onClick={takeFromEvent}
                onFocus={takeFromEvent}
              >
                {disciplines.map((discipline, i) => (
                  // Offset by one: this list is the disciplines, the cycle is
                  // the intro plus the disciplines. Row `i` is slide `i + 1`,
                  // and while the intro is up no row is current — which is the
                  // honest reading, since the frame on screen is not one of
                  // these.
                  <li
                    key={discipline.slug}
                    // Each row on its own beat. The rule above the list is
                    // not faded with them — a border arriving is a border
                    // twitching, and the list wants an edge to arrive into.
                    // That rule is now the only one in the block: the running
                    // head had a `border-b` of its own, which stacked a
                    // second line 65px under the fixed bar's own border for
                    // no work — two rules to separate one line of type.
                    style={at(INDEX_MS + i * ROW_MS)}
                    className="rise border-b border-border"
                    data-discipline={i + 1}
                  >
                    <Link
                      prefetch={false}
                      href={discipline.href}
                      aria-current={i + 1 === active ? "true" : undefined}
                      className={cn(
                        // `py-3.5`, with text-3xl. The type column is what
                        // sets the height of this section, the 80dvh picture
                        // track loses to it, so every pixel of row height is
                        // a pixel the buttons drop. Julian asked for bigger
                        // type and then for more air between the rows; at
                        // `py-4` the sixth row ran under the rail on a
                        // 1440x900 screen, and two pixels a side clears it.
                        // `cover-row` tightens the rows on a short window;
                        // the rule is in `globals.css`.
                        "cover-row group flex items-baseline gap-4 px-6 py-3.5 transition-colors duration-300 sm:px-10",
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
                          "font-display text-2xl uppercase leading-none tracking-[0] transition-colors duration-300 sm:text-3xl short:text-xl short:sm:text-2xl",
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

            {/* The phases, at a thumb's size. One tick per discipline, the
                current one lit, each a link to its page and each a target for
                the same delegated handler the rows use — so tapping a tick
                switches the cover the way hovering a row does. Only on a
                phone: on any wider screen a second row of marks would sit
                just above the strip's ruler saying something different with
                the same shape, so an upright tablet, which hides the rows
                too, gets neither and keeps the buttons. */}
            <ol
              aria-label="Disciplines, on the picture"
              onPointerOver={takeFromHover}
              onClick={takeFromEvent}
              onFocus={takeFromEvent}
              className="mt-4 hidden gap-1 px-6 max-sm:tall:flex tall:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            >
              {disciplines.map((discipline, i) => (
                <li
                  key={discipline.slug}
                  data-discipline={i + 1}
                  className="flex-1"
                >
                  <Link
                    prefetch={false}
                    href={discipline.href}
                    aria-label={discipline.name}
                    aria-current={i + 1 === active ? "true" : undefined}
                    className="block py-3"
                  >
                    <span
                      className={cn(
                        "block h-px transition-colors duration-300",
                        i + 1 === active ? "bg-foreground" : "bg-foreground/25",
                      )}
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
