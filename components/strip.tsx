"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Deck } from "@/lib/deck";
import { cn } from "@/lib/utils";
import { useArrival, useArrivalOrder, useSeatKeeper } from "@/components/strip/arrival";
import { useCue } from "@/components/strip/cue";
import { useDeal, useMoreSections, useSections } from "@/components/strip/deck";
import { useLenis } from "@/components/strip/lenis";
import { useTablet, useWide } from "@/components/strip/media";
import { useSlides } from "@/components/strip/paging";
import { useFarCells, usePrefetch, useWarmAhead } from "@/components/strip/prefetch";
import { useRackPairs, useWall } from "@/components/strip/rack";
import { StripRail, useRail } from "@/components/strip/rail";
import { useStacked } from "@/components/strip/stacked";
import { useMotion } from "@/components/strip/use-motion";
import { useReader, type Tick } from "@/components/strip/use-reader";

export { markFilter } from "@/components/strip/shared";
export { useTablet, useWide, useWideNow } from "@/components/strip/media";

/* ── the strip ────────────────────────────────────────────────────
 * One screen, and the page runs across it. This is the machine behind
 * every horizontal page on the site: the wheel moves the sequence
 * sideways under friction, a mouse can drag it, the ends give like a
 * rubber band, a wheel that keeps pushing past the end leads on to the
 * next page, and the pictures lean with the speed. It began as the
 * project page's filmstrip (`project-strip.tsx`) and was lifted out
 * unchanged when Julian asked for the horizontal look across the whole
 * site: one machine, many sequences, so they all move the same.
 *
 * Native scrolling, not a transform driven by pointer events. It costs
 * nothing to a keyboard, a touchscreen swipes it with the platform's own
 * momentum, and a trackpad's horizontal gesture works without being
 * interpreted. See "how it moves" (`strip/motion.ts`) for the two
 * things added for a mouse.
 *
 * ── where the parts are ──
 * This file is the component and its props. The machine is in
 * `components/strip/`, one hook or set of handlers to a job:
 *   `use-motion.ts`  how it moves: `motion.ts` the travel, `wheel.ts`,
 *                    `touch.ts`, `drag.ts`, `keyboard.ts`, `band.ts` and
 *                    `lead.ts` the ends, `paging.ts` the landing
 *   `lenis.ts`       Lenis on the wheel
 *   `use-reader.ts`  where the strip is, read as it moves
 *   `rail.tsx`       the rail and the ruler under it
 *   `deck.tsx`       the deck, and the sections held back (`defer`)
 *   `arrival.ts`     where it opens and how it comes in
 *   `prefetch.ts`    the pages either end, and the photographs ahead
 *   `rack.ts`        the grid view's pairs and walls
 *   `stacked.ts`     stacked down a phone
 *   `cue.ts`         the sideways cue
 *   `shared.ts`      what the parts share
 *
 * ── the cell contract ──
 * Every direct child is a cell, a plain element (no fragments: the ruler
 * counts children by index and the DOM has to agree). On the cell:
 *   `data-tick`          a tick on the ruler under the strip
 *   `data-label="Reel"`  the word for the running head and the tick
 *   `data-hash="reel"`   a deep-link target: /page#reel opens on this cell
 *   `.strip-cell` + `--i` the staggered arrival (`globals.css`)
 * Inside a cell:
 *   `data-n={i}` on a button   the delegated `onOpen(i)` (a lightbox)
 *   `.strip-frame` on an image the parallax slide
 *   `data-ring="Open"`         the word under the pointer ring
 *   `[data-scroll]` box        the wheel scrolls it first, then the strip
 * ─────────────────────────────────────────────────────────────── */

/** A page either side of this one: where the wheel goes past an end. */
export type Lead = {
  href: string;
  name: string;
  client?: string;
  /** Walking back into it opens at its start, not its end (Julian: back
      from Sessions lands on the first page of the work). */
  start?: boolean;
  /** The first photographs it opens on, as its page will ask for
      them, fetched with the page so its card comes in with them. */
  warm?: { src: string; srcSet?: string; sizes?: string }[];
};

/* ── the other way of looking at it ───────────────────────────────
 * A strip is a sequence and a grid is an inventory, and the two answer
 * different questions about the same set: "walk me through it" against
 * "show me everything". /work is 34,512px of ribbon - twenty-four screens
 * at 1440 - and until now there was no way to see it at once.
 *
 * Context rather than a prop, because the control is in the layout
 * (`work-shell.tsx`, which survives a filter change) and the strip is in
 * the page under it. A strip nobody wraps reads the default and is exactly
 * what it was.
 */
export type StripViewMode = "strip" | "grid";
export const StripView = React.createContext<StripViewMode>("strip");

export function Strip({
  children,
  label,
  next,
  prev,
  onOpen,
  counter,
  pageCount,
  stack = true,
  paged = false,
  chapters = false,
  map,
  bleed = false,
  arrive,
  deck,
  defer = false,
  ref,
  className,
}: {
  children: React.ReactNode;
  /** What the scroller says to a screen reader. */
  label: string;
  /** Where a wheel pushed past the end goes. */
  next?: Lead;
  /** Where a wheel pushed past the start goes. Project chains only: a
      visitor at the top of a page should not be thrown off it backwards. */
  prev?: Lead;
  /** A press on a `[data-n]` button inside a cell, by its number. */
  onOpen?: (n: number) => void;
  /** Drawn left of the ruler, given the index of the cell in the middle. */
  counter?: (at: number) => React.ReactNode;
  /** The screen you are on, "01 / 06", left of the ruler, read off
      the ticks. For a page that cannot hand a `counter` across from
      the server. */
  pageCount?: boolean;
  /** Under 40rem, run the cells down the page instead and switch the
      machine off. Off for the project strips, which swipe on a phone. */
  stack?: boolean;
  /** One screen at a time. A notch, a swipe or a flick moves to the next
      cell and stops there, instead of the sequence running free under the
      hand. For pages whose cells are whole screens rather than pictures:
      the movement means "the next thing", not "a bit further along". */
  paged?: boolean;
  /** No gutter and no gap, so a cell that is `w-full` is exactly the
      window. Goes with `paged`. */
  bleed?: boolean;
  /** No arrival slide. The homepage's cover must not move in. */
  arrive?: "none";
  /** Deal the cells as a deck, each pinning at the left while the next
      slides over it (`lib/deck.ts`). "pile" for the cells marked
      `data-deck`, "screens" for every cell. Wide screens only. */
  deck?: Deck;
  /** Arriving by navigation, mount the first two sections and the rest
      once the page has landed and gone quiet. The work index only. */
  defer?: boolean;
  /** Run the ruler in chapters rather than in ticks: one segment per
      section, all of them the same width, and the one under the pointer
      opens into the cells it holds. The work index only, where eighty four
      covers under twelve disciplines made eighty four four-pixel ticks of
      a rail that was really a table of contents. */
  chapters?: boolean;
  /** The whole archive as chapters, for a page that holds one of them.
      A filter's strip carries only its own work, so the chaptered rail
      above saw a single section and fell back to plain ticks: inside
      Editorial the rail was thirty three identical stops and nothing said
      which of eleven disciplines you were standing in. Julian asked for
      the rail to stay the same when a filter is entered.

      So the page hands the rail the row it belongs to. The entry marked
      `here` is this strip, open and scored into its own work; the rest are
      shut, name themselves under the pointer and are pressed to go
      there. */
  map?: { name: string; href: string; here?: boolean }[];
  /** The scroller, for a lightbox that lifts frames out of it. */
  ref?: React.Ref<HTMLDivElement | null>;
  className?: string;
}) {
  const scroller = React.useRef<HTMLDivElement>(null);
  const { sections, setSections, shown, holding } = useSections(children, defer, deck);
  const view = React.useContext(StripView);
  const grid = view === "grid";
  /* On an iPad the grid runs down instead (`useTablet`): the cells are a
     sheet in a box that scrolls, and the sideways machine is off. */
  const tablet = useTablet();
  const sheet = grid && tablet;
  const heldBack = useDeal({ scroller, deck, shown, sheet, holding });
  React.useImperativeHandle(ref, () => scroller.current!, []);
  const [at, setAt] = React.useState(0);
  /** Which tick the pointer is over, as a place in `ticks`, or null. */
  /** Whether the strip has stopped. The rail's shape waits for it. */
  const [still, setStill] = React.useState(true);
  useMoreSections({ scroller, holding, still, sections, setSections, deck });
  /** Where a press on the rail is taking the strip, as a place in `ticks`.
      Let go after browsing the rail and the strip has a second of coasting
      left in it; without this the rail went flat for all of it and then
      opened, which reads as the instrument losing its place. It knows
      where the journey ends the moment the finger lifts, so it settles
      there and waits for the pictures to arrive. */
  const [aim, setAim] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<number | null>(null);
  /** Which chapter of the archive the pointer is over, where that chapter
      is another page: it holds no ticks, so `over` cannot say it. */
  const [overAway, setOverAway] = React.useState<number | null>(null);
  /* ── the sideways cue ──
     A visitor arriving on a page that runs sideways has nothing telling
     them so. The rail is the instrument, so the rail is what says it: the
     lit chapter travels once and settles, two seconds in. The first sign
     of the page being moved kills it, and it does not come back in the
     session. Nothing inside the photograph moves for it. */
  const [cue, setCue] = React.useState(false);
  /* The wall's stylesheet is scoped to this strip and no other. */
  const wallId = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [ticks, setTicks] = React.useState<Tick[]>([]);
  const tickKey = React.useRef("");
  // For the keyboard, which lives in an effect and must not go stale.
  const atRef = React.useRef(0);
  const wide = useWide();
  /* The machine runs in both views. The sheet is a rack - two rows deep,
     running sideways - and not a page of its own that scrolls downwards:
     Julian asked for the grid to be horizontal too, and the version that
     scrolled down had to switch the wheel, the drag, the ruler and the
     lead-on off to do it, which is most of what made changing a filter
     feel like changing pages. Same gestures, twice the work on screen. */
  const live = (stack ? wide : true) && !sheet;

  useSlides({ scroller, live, paged, ticks });
  useStacked(scroller, live);
  useRackPairs({ scroller, grid, sheet, shown });
  const router = useRouter();
  // Stable for the life of the strip: pages key it by what it shows.
  const nextHref = next?.href;
  const nextWarm = next?.warm;
  const prevHref = prev?.href;
  const prevStart = prev?.start === true;
  const open = React.useRef(onOpen);
  React.useEffect(() => {
    open.current = onOpen;
  });
  /* A press on a numbered button opens it. Delegated, so a page can build
     its cells once and the opener is reached through a ref. Its own
     effect, not the machine's: a strip stacked down a phone has the
     machine off and its frames still open. */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const openCell = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.<HTMLElement>(
        "[data-n]",
      );
      if (b && el.contains(b)) open.current?.(Number(b.dataset.n));
    };
    el.addEventListener("click", openCell);
    return () => el.removeEventListener("click", openCell);
  }, []);
  // The cells mounted, so the wall and the ruler measure again when the
  // held-back sections arrive (`defer`).
  const count = React.Children.count(shown);

  usePrefetch({ scroller, live, router, nextHref, nextWarm, prevHref });
  useWarmAhead(scroller, live, count);

  /** The scroll position, kept live: a cleanup cannot read it off the
      element, which is detached by then. */
  const seatX = React.useRef(0);

  useArrival({ scroller, live, arrive, seatX });
  useArrivalOrder(scroller);
  useFarCells(scroller, live, paged);
  useSeatKeeper({ scroller, live, seatX });
  useCue({ scroller, live, paged, setCue });
  useWall({ scroller, grid, live, wide, count, wallId });

  /* ── Lenis ── (`strip/lenis.ts`) */
  useLenis(scroller, live, paged);

  /* Which cell is nearest the middle of the window. Read off the scroll
     position rather than with an observer, because the counter and the
     ruler want it every frame of a drag and not on a threshold
     (`strip/use-reader.ts`). */
  const glide = React.useRef<(to: number) => void>(() => {});
  /** The cell the address named on arrival, re-aimed at on each re-lay
      until the visitor moves the row themselves (below). A ref, so the
      ruler and a link can spend it as well as the scroller's own events. */
  const aimed = React.useRef("");
  useReader({
    scroller,
    live,
    count,
    paged,
    atRef,
    setAt,
    setTicks,
    tickKey,
    setStill,
    setAim,
    seatX,
    glide,
    aimed,
  });

  /* ── how it moves ── (`strip/use-motion.ts`) */
  useMotion({
    scroller,
    live,
    paged,
    deck,
    nextHref,
    prevHref,
    prevStart,
    router,
    heldBack,
    glide,
  });

  /* ── running a finger along the ruler ── (`strip/rail.tsx`) */
  const rail = useRail({
    scroller,
    ticks,
    at,
    aim,
    setAim,
    over,
    setOver,
    overAway,
    setOverAway,
    map,
    chapters,
    router,
    glide,
    aimed,
  });

  return (
    /* `strip-band` carries the tablet and phone squeeze: the pages set
       `mt-4` on this and a coarse window cannot spare it. In CSS rather
       than a variant here, because the margin arrives from the page. */
    <div
      className={cn("strip-band flex min-h-0 flex-col", className)}
      /* Somebody is on the ruler. Two things read this: the word above
         the open chapter grows for as long as it is set, and the
         photographs lift a little to say the strip is listening - both
         in `globals.css`. On the root and not on the rail so the cells
         are under it; it outlives the pointer by the chapter's own beat,
         so a drift off the line does not drop the pictures and start
         the word over. */
      data-dwell={rail.chaptered && over !== null ? "" : undefined}
    >
      <div
        ref={scroller}
        /* A region, so the label below has a role to hang on. Without one
           this was a `generic` div carrying a name, which ARIA prohibits
           and some readers drop: a visitor on a screen reader arrived at a
           focusable thing with no word for what it was. */
        role="region"
        tabIndex={0}
        aria-label={label}
        /* What kind of region: a row that moves sideways, screen by
           screen, under the arrows. Not once it runs down a phone. */
        aria-roledescription={live ? "carousel" : undefined}
        /* Dealt as a deck: `globals.css` makes every cell opaque. */
        data-dealt={sheet ? undefined : deck}
        data-sheet={sheet ? "" : undefined}
        /* The browser's own drag and drop never gets the gesture.
           A cover in the index is a link around a photograph, and both of
           those are things Chrome will happily pick up and carry: a drag
           that began on one handed the pointer to native drag and drop,
           which showed a ghost of the link, refused to drop anywhere, and
           left the strip sitting where it was. Measured on production: of
           five drags across the category strips, two turned into that -
           the strip moved 28px of the 280 asked for while 35 `dragover`
           events ran at 176ms each. `-webkit-user-drag: none` on `img` in
           `globals.css` and the `dragstart` guard in `photo-notice.tsx`
           both stop short of it, because the element being dragged is the
           anchor, not the picture inside it.

           Here and not on the document, so dragging a link out of the
           footer, the nav or a page of prose still works. */
        onDragStart={(e) => e.preventDefault()}
        /* No scroll snapping. Every movement here is a scroll the strip
           started itself - a wheel notch, a drag, a flick's momentum, a
           tick - and snap re-aims each one as it settles, which reads as
           the sequence being tugged out of your hand. The momentum stops
           where it is let go instead. */
        /* The whole shelf is draggable, but the pointer does not say so:
           Julian, no DRAG. A cover inside it still has its own word. */
        className={cn(
          "flex min-h-0 flex-1 select-none items-center",
          bleed ? "gap-0" : "gap-3 px-6 sm:px-10 sm:gap-4",
          /* It takes focus and the arrow keys drive it, so it says so. The
             ring is inset, because an outline around a box the height of
             the window would be a frame around the photographs. */
          "strip-scroll focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-foreground/40",
          // Stacked: the cells run down the page, which scrolls as pages
          // do, with nothing hidden, nothing sliding in, and the words
          // selectable again.
          // Everything above is the strip's; `strip-grid` in `globals.css`
          // takes the same cells and lays them out as a sheet instead.
          "overflow-x-auto overflow-y-hidden",
          // The same cells, two rows deep: `strip-grid` in `globals.css`.
          grid && "strip-grid",
          // Snap for a finger, `globals.css`; a mouse and the keyboard
          // are paged by hand above.
          paged && "strip-paged",
          stack &&
            "max-sm:animate-none max-sm:flex-col max-sm:items-stretch max-sm:gap-6 max-sm:overflow-visible max-sm:select-auto",
          // Stacked, a full-bleed page still wants its words off the edge.
          bleed && stack && "max-sm:gap-0",
        )}
      >
        {shown}
      </div>

      <StripRail
        rail={rail}
        stack={stack}
        counter={counter}
        pageCount={pageCount}
        at={at}
        ticks={ticks}
        cue={cue}
        over={over}
        overAway={overAway}
        still={still}
        aim={aim}
      />
    </div>
  );
}
