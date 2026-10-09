"use client";

import { runDeck, type Deck } from "@/lib/deck";
import * as React from "react";
import { flushSync, preload } from "react-dom";
import { useRouter } from "next/navigation";
import { cn, STRIP_SECTION } from "@/lib/utils";
import { flyCovers } from "@/lib/work-view";
import { Liquid, useQuiet } from "@/components/liquid";
import { useLenis } from "@/components/strip/lenis";
import {
  cellFor,
  centreOf,
  DEAL_MS,
  FILTER_MS,
  leftOf,
  nav,
  POP_MS,
  RELAID,
  seat,
  SECTIONS_FIRST,
} from "@/components/strip/shared";
import { useMotion } from "@/components/strip/use-motion";
import { useReader, type Tick } from "@/components/strip/use-reader";

export { markFilter } from "@/components/strip/shared";

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
 * interpreted. See "how it moves" below for the two things added for a
 * mouse.
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
  /** The first photographs it opens on, as its page will ask for them,
      fetched with the page so its card comes in with them (Julian,
      2026-10-08). */
  warm?: { src: string; srcSet?: string; sizes?: string }[];
};

/** How long a visitor is left alone before the rail says the page runs
    sideways, how long the travel lasts, and where the session remembers
    that it has already been said. */
const CUE_WAIT = 2000;
const CUE_MS = 900;
const CUE_SEEN = "strip-cue";
/** Julian (2026-10-01): the page itself shows there is more. A paged strip
    slides this far left as the rail travels, the next screen's edge comes
    in, and it springs back. Preview only, `?peek=1`, which also shows it
    on every load so it can be watched again. */
const PEEK = 64;

/** How wide a column of the wall wants to be, as a share of the shelf's
    height, and the width past which a single frame has to share its
    column rather than stand there as a billboard. */
const WALL_WANT = 0.46;
const WALL_CAP = 0.95;

/** How long an open chapter waits after the pointer has left it, in ms.
    Julian, having asked for a bigger target first: hold it open for a
    beat. A mouse running the length of the ruler drifts off it and back
    on inside a couple of hundred milliseconds, and a chapter that shut on
    the way past had to be found again. Four hundred forgives the drift
    without the rail feeling stuck to the pointer; coming back inside it
    is not a re-entry at all, because nothing shut. */
const LINGER = 400;

/** Where a strip stops being a strip. Under this the cells of a stacking
    page run down the screen and the machine is off; the value is the
    `sm` breakpoint, the same one `globals.css` unlocks the page at. */
const WIDE = "(min-width: 40rem)";
const subscribeWide = (onChange: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
export const useWide = () =>
  React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    // The server draws the wide page; a phone corrects itself on hydration.
    () => true,
  );
/** A touch screen with room, held upright: an iPad. Its grid is a sheet that runs down
    (Julian, 2026-10-08: the rack's covers were too small there, 210px
    across. Landscape keeps the rack sideways, Julian asked). */
const TABLET = "(pointer: coarse) and (min-width: 40rem) and (orientation: portrait)";
const subscribeTablet = (onChange: () => void) => {
  const mq = window.matchMedia(TABLET);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
export const useTablet = () =>
  React.useSyncExternalStore(
    subscribeTablet,
    () => window.matchMedia(TABLET).matches,
    () => false,
  );
/** The same question for what the page fetches, answered the other way
    round on the server: a frame marked eager in the HTML is requested as
    the parser meets it, before any script can take it back, so the HTML
    says lazy and a wide window turns the rest eager as it hydrates. A
    phone, where the page stacks ten screens tall, keeps them lazy. */
export const useWideNow = () =>
  React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => false,
  );

/** A landscape window with room in it: where the ruler runs in chapters.
    It asked for a mouse as well, because a chapter only opened under a
    hover and a finger has none. It no longer needs one: the chapter you
    are standing in is open from the start and the rest are opened by
    dragging along the rail, which a finger does. Without this an iPad
    drew All work as a hundred and seventy seven ticks five pixels wide.
    A portrait window still has no width to open a chapter into, and
    neither has a phone held sideways. */
const DESK = "(min-aspect-ratio: 5 / 4) and (min-width: 48rem)";
const subscribeDesk = (onChange: () => void) => {
  const mq = window.matchMedia(DESK);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const useDesk = () =>
  React.useSyncExternalStore(
    subscribeDesk,
    () => window.matchMedia(DESK).matches,
    // The plain ruler on the server, and a desktop swaps to chapters on
    // hydration. It is `aria-hidden` decoration either way, so nothing a
    // reader is holding on to moves under it.
    () => false,
  );

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
  /** The screen you are on, "01 / 06", left of the ruler, read off the
      ticks. For a page that cannot hand a `counter` across from the
      server (Julian, 2026-10-07: the homepage). */
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
  /* Julian (2026-10-01): only the discipline being shown and the next.
     Arriving at the portfolio built all ninety three projects inside the
     page transition, 1,100 elements and 130ms of long tasks with the
     screen held; a discipline page of 300 had none. So a navigation here
     mounts the first two sections, and the rest follow a section at a
     time once the arrival is over (`data-nav` gone from the root) and the
     page is idle: all at once, mid-transition, they cost 87ms and seven
     dropped frames. Whole at once when the visitor is coming back to a
     place in it (the back button's seat, a #discipline typed in), and
     always on the server and the cold load, so the markup and the
     crawlers have every project. Not the hash at render: the address
     still holds the page being left (`/#where-next`).
     A deck of screens (the homepage) mounts the one it lands on: coming
     back from the portfolio, the second screen's eight covers and logos
     were built inside the swap, while the screen held for 300ms
     (scroll-craft pass, 2026-10-02). */
  const [sections, setSections] = React.useState(() =>
    !defer || !nav.hydrated || Date.now() - nav.poppedAt < POP_MS || Date.now() - nav.aimedAt < POP_MS
      ? Infinity
      : deck === "screens"
        ? 1
        : SECTIONS_FIRST,
  );
  /* Whether anything is still held back is this memo's to say, not a count
     of the two: `Children.count` counts an empty child and `toArray` drops
     it, so a page with one (the homepage) counted its children at eight
     and the sections shown at seven for ever. Coming back from the
     portfolio, that asked for more sections at every idle slot without
     end, and each one dealt the deck again: the hero lost its `data-buried`
     and its photographs showed under the glass as a grey band, and the
     paging lost its places and the wheel stuck (Julian, 2026-10-02). */
  const [shown, holding] = React.useMemo(() => {
    if (sections === Infinity) return [children, false] as const;
    const all = React.Children.toArray(children);
    let heads = 0;
    /* A section opens on the cell marked `data-deck`, as the deck reads
       it: rendered on the server, it reaches here as that element, not as
       the component that drew it. On the homepage every screen is one. */
    const opens = (c: React.ReactNode) =>
      deck === "screens" ||
      (React.isValidElement<Record<string, unknown>>(c) && "data-deck" in c.props);
    const cut = all.findIndex((c) => opens(c) && ++heads > sections);
    if (cut < 0) return [all, false] as const;
    /* The later sections' openings go in now, only their covers wait:
       the ruler reads its chapters off them, and with two of thirteen it
       drew fifty six ticks until the rest arrived. */
    if (deck !== "screens")
      return [[...all.slice(0, cut), ...all.slice(cut).filter(opens)], true] as const;
    /* A screen waits as an empty one in its place, so the rail has all
       its ticks and the strip its whole length from the first frame, and
       the screen comes in where it already stood. Coming back from the
       portfolio the rail grew a tick at a time for a second or more
       (Julian: the scrollbar takes a minute to load). The window into the
       work is no screen: zero wide and tickless, it goes in as it is. It
       is told by the covers it is handed, not by its type: from the
       server it reaches here wrapped, never as `LeadWindow` itself. */
    return [
      [
        ...all.slice(0, cut),
        ...all.slice(cut).map((c, i) =>
          React.isValidElement<Record<string, unknown>>(c) && "covers" in c.props ? (
            c
          ) : (
            <div
              key={`held-${cut + i}`}
              data-held=""
              data-tick=""
              aria-hidden
              className="w-full shrink-0 sm:h-full"
            />
          ),
        ),
      ],
      true,
    ] as const;
  }, [children, sections, deck]);
  React.useEffect(() => {
    nav.hydrated = true;
  }, []);
  const view = React.useContext(StripView);
  const grid = view === "grid";
  /* On an iPad the grid runs down instead (`useTablet`): the cells are a
     sheet in a box that scrolls, and the sideways machine is off. */
  const tablet = useTablet();
  const sheet = grid && tablet;
  /* For the wheel, whose effect must not run again as sections arrive. */
  const heldBack = React.useRef(false);
  React.useEffect(() => {
    heldBack.current = holding;
  }, [holding]);
  React.useEffect(() => {
    const el = scroller.current;
    if (!deck || !el || sheet) return;
    return runDeck(el, deck);
    // Dealt again as each held-back section arrives.
  }, [deck, shown, sheet]);
  React.useImperativeHandle(ref, () => scroller.current!, []);
  const [at, setAt] = React.useState(0);
  /** Which tick the pointer is over, as a place in `ticks`, or null. */
  /** Whether the strip has stopped. The rail's shape waits for it. */
  const [still, setStill] = React.useState(true);
  React.useEffect(() => {
    // Never under a moving strip: each section deals the deck again.
    if (!holding || !still) return;
    const root = document.documentElement;
    let idle = 0;
    /* Not in `startTransition`: here that runs the page-wide view
       transition (`page-transition.tsx`), and every section crossfaded the
       whole page, a ghost of the hero each second after landing. */
    const more = () => setSections((n) => n + 1);
    const later = () => {
      idle =
        typeof window.requestIdleCallback === "function"
          ? window.requestIdleCallback(more, { timeout: 1500 })
          : window.setTimeout(more, 200);
    };
    const landed = new MutationObserver(() => {
      if (root.dataset.nav !== undefined) return;
      landed.disconnect();
      later();
    });
    if (root.dataset.nav === undefined) later();
    else landed.observe(root, { attributes: true, attributeFilter: ["data-nav"] });
    return () => {
      landed.disconnect();
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      window.clearTimeout(idle);
    };
  }, [holding, sections, still]);
  React.useEffect(() => {
    const el = scroller.current;
    if (!holding || !el) return;
    /* A strip that keeps moving never rests for the idle path above, and
       ran on past openings with nothing behind them (Julian, 2026-10-02).
       So the next section also comes in once it is a screen and a half
       away, moving or not. */
    let asked = false;
    const near = () => {
      if (asked) return;
      const next =
        deck === "screens"
          ? el.querySelector<HTMLElement>(":scope > [data-held]")
          : el.querySelectorAll<HTMLElement>(":scope > [data-deck]")[sections];
      /* A held screen by where it stands in layout: the deck pins it, and
         a pinned one reads as wherever the window is. */
      const ahead = !next
        ? el.scrollWidth - el.scrollLeft - el.clientWidth
        : deck === "screens"
          ? leftOf(next) - el.scrollLeft - el.clientWidth
          : next.getBoundingClientRect().left - el.getBoundingClientRect().right;
      if (ahead > el.clientWidth * 1.5) return;
      asked = true;
      setSections((n) => n + 1);
    };
    el.addEventListener("scroll", near, { passive: true });
    // Before the strip's own listener looks for the cell (`onHash`).
    const onHash = () => flushSync(() => setSections(Infinity));
    window.addEventListener("hashchange", onHash);
    return () => {
      el.removeEventListener("scroll", near);
      window.removeEventListener("hashchange", onHash);
    };
  }, [holding, sections, deck]);
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

  /* A paged strip's screens say which they are to a screen reader: a
     group, read as a slide, named with its word and where it stands,
     "Biography, 3 of 7". Written onto the cells here, since a cell is
     often a component of its own; never onto one that is a control or
     already has a role, and a name it already has is kept, with the
     position after it. A free strip says its position once, on the
     `progressbar` under it. */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el || !live || !paged || !ticks.length) return;
    const set: { c: HTMLElement; named: boolean }[] = [];
    ticks.forEach((t, n) => {
      const c = el.children[t.i] as HTMLElement | undefined;
      if (!c || c.hasAttribute("role") || c.matches("a, button, input, select, textarea, dialog"))
        return;
      c.setAttribute("role", "group");
      c.setAttribute("aria-roledescription", "slide");
      const where = `${n + 1} of ${ticks.length}`;
      const own = c.getAttribute("aria-label");
      const named = !c.hasAttribute("aria-labelledby");
      if (named) c.setAttribute("aria-label", `${own ?? t.word ?? ""}${own || t.word ? ", " : ""}${where}`);
      c.dataset.slide = own ?? "";
      set.push({ c, named });
    });
    return () => {
      for (const { c, named } of set) {
        c.removeAttribute("role");
        c.removeAttribute("aria-roledescription");
        if (named) {
          if (c.dataset.slide) c.setAttribute("aria-label", c.dataset.slide);
          else c.removeAttribute("aria-label");
        }
        delete c.dataset.slide;
      }
    };
  }, [live, paged, ticks]);

  /* Past the opening cell, stacked down a phone as well: the page's own
     scroll, half the cell gone off the top, as `data-past-first` says it
     sideways (`read` below). Its own name, so only the navbar's wordmark
     reads it, not the running heads of the stacked pages (Julian,
     2026-10-04: the name in the bar on an iPhone once the hero is passed). */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el || live) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const first = el.firstElementChild as HTMLElement | null;
      const r = first?.getBoundingClientRect();
      el.toggleAttribute("data-past-hero", !!r && r.top + r.height / 2 < 0);
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", soon, { passive: true });
    window.addEventListener("resize", soon);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", soon);
      window.removeEventListener("resize", soon);
      el.removeAttribute("data-past-hero");
    };
  }, [live]);

  /* Stacked down a phone the strip is not live: none of its scrolling runs,
     and the cells are no more than sections of a page that scrolls. Its
     jumps went with it. Cells carry `data-hash`, not an id, so the browser
     could not find them either, and every link to a screen (the cover's
     Book a session, the menu's About, /sessions redirecting to
     /#sessions) changed the address and left a phone at the top. Here the
     page is scrolled to the cell instead: on arrival, on a hash change, and
     on a link to this page, which Next moves without a hashchange. */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el || live) return;
    let jumped = 0;
    const go = (smooth: boolean) => {
      const i = cellFor(el, decodeURIComponent(window.location.hash.slice(1)));
      const cell = el.children[i] as HTMLElement | undefined;
      if (!cell) return false;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      /* The screens off the window are skipped until near it (`globals.css`,
         `content-visibility`) and hold a guessed height, so a glide past
         them drew each at its real one on the way and landed hundreds of
         pixels short. Drawn in full for the journey, skipped again after. */
      el.setAttribute("data-jump", "");
      clearTimeout(jumped);
      /* Two frames on: a screen drawn once keeps its real height when it
         is skipped again (`auto`), so nothing above the window moves. */
      const done = () => {
        clearTimeout(jumped);
        window.removeEventListener("scrollend", done);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => el.removeAttribute("data-jump")),
        );
      };
      cell.scrollIntoView({ block: "start", behavior: smooth && !still ? "smooth" : "auto" });
      window.addEventListener("scrollend", done, { once: true });
      // Safari without `scrollend`, or a jump with nowhere to go.
      jumped = window.setTimeout(done, 1500);
      return true;
    };
    go(false);
    const onHash = () => go(true);
    const onLink = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.<HTMLAnchorElement>("a[href]");
      if (!a || a.target) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname) return;
      if (cellFor(el, decodeURIComponent(url.hash.slice(1))) < 0) return;
      e.preventDefault();
      history.pushState(null, "", url.href);
      /* `pushState` fires no event, so the bar, which reads the address
         through `STRIP_SECTION` and `hashchange`, heard nothing and lit
         the new screen only when something else re-rendered it. The dev
         build re-renders enough to hide that; production did not
         (measured 2026-10-07). Said here, the moment the address moves. */
      window.dispatchEvent(new Event(STRIP_SECTION));
      go(true);
    };
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onLink, true);
      clearTimeout(jumped);
    };
  }, [live]);

  /* ── the rack pairs like with like ────────────────────────────
   * A column of the rack is two cells one above the other and is as wide
   * as the wider of them, so a portrait sitting above a landscape is
   * printed in a column half as wide again as itself and the rest of that
   * column is paper. Measured on production at 1600: Event coverage put a
   * portrait with a landscape in 5 of its 13 columns, Automotive in 4 of
   * 11, Places in 5 of 12, and inside one of those columns the narrower
   * frame is left in a hole about 45% as wide as itself. Julian: the
   * upright ones can stand next to each other so there is no empty space.
   *
   * So the cells are re-ordered, not resized: nothing is cropped and no
   * frame changes shape. Each cell is paired with the next one of its own
   * orientation, and `order` puts the two of them in the same column.
   * Greedy and in sequence, so a run stays close to the order it was
   * given rather than being sorted into all the uprights and then all the
   * wide ones.
   *
   * The words that open a discipline span both rows and take a whole
   * column of their own; they are left exactly where they are, and the
   * pairing starts again after each of them, because that is where the
   * grid starts a fresh column anyway.
   *
   * Read from the DOM and not from the children, because `--ar` is set by
   * the cell on the element it renders and a parent holding the React
   * element cannot see it. One pass on the way into the rack, one
   * `getComputedStyle` per cell; the strip view clears what it wrote.
   */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const kids = Array.from(el.children) as HTMLElement[];
    // The sheet runs in rows, in the strip's own order.
    if (!grid || sheet) {
      for (const k of kids) {
        k.style.order = "";
        delete k.dataset.alone;
      }
      return;
    }
    /* A cell that is not a picture spans both rows — see `.strip-grid` in
       `globals.css` — so it is a column on its own and an anchor here.
       `data-tick` and not the tag: the card that leads on to the next
       discipline is a link like a cover is, and pairing it with a frame
       moved it out of the end of the sequence and left it stranded in the
       middle of the rack. The ruler counts what belongs to the sequence
       and marks it; everything else stays where it was put. */
    const picture = (k: HTMLElement) =>
      (k.tagName === "A" || k.tagName === "BUTTON") &&
      k.dataset.tick !== undefined;
    const upright = (k: HTMLElement) =>
      (parseFloat(getComputedStyle(k).getPropertyValue("--ar")) || 0.8) < 1;

    const taken = new Array(kids.length).fill(false);
    let at = 0;
    for (let i = 0; i < kids.length; i++) {
      if (taken[i]) continue;
      taken[i] = true;
      kids[i].style.order = String(at++);
      if (!picture(kids[i])) continue;
      /* Its partner: the next free cell standing the same way up, and
         not past the words that begin the next discipline. The same way
         up and not the nearest shape: pairing each cell with the closest
         `--ar` within reach was measured worse on two galleries of three,
         because a good local match spends the partner a later cell needed
         more. 7.1% of the rack left empty across the three this way,
         9.9% that way. */
      const want = upright(kids[i]);
      let alone = true;
      for (let j = i + 1; j < kids.length; j++) {
        if (!picture(kids[j])) break;
        if (taken[j] || upright(kids[j]) !== want) continue;
        taken[j] = true;
        kids[j].style.order = String(at++);
        alone = false;
        break;
      }
      /* No partner: the row under it may be a hole, and the chapter
         behind showed through it (`[data-alone]` in globals.css). */
      if (alone) kids[i].dataset.alone = "";
      else delete kids[i].dataset.alone;
    }
    /* On `shown`, not `children`: the held-back sections (`defer`) arrive
       without the parent rendering again, and a cover written no `order`
       sorts as nought, to the front of the rack. Coming through the door
       into the grid, Artist Presskit and Portraits stood where Editorial
       belonged (Julian, 2026-10-02). */
  }, [grid, sheet, shown]);
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

  /* Julian: a delay between the scroll and the page switching. The page
     led on to was fetched only once the strip left, so the deal waited on
     the network. Each end's page is fetched once the strip is within a
     screen and a half of it, one request a way, well before the push. */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el || !live || (!nextHref && !prevHref)) return;
    const warmed = new Set<string>();
    const warm = () => {
      const near = el.clientWidth * 1.5;
      const room = el.scrollWidth - el.clientWidth;
      if (nextHref && room - el.scrollLeft < near && !warmed.has(nextHref)) {
        warmed.add(nextHref);
        router.prefetch(nextHref);
        for (const f of nextWarm ?? [])
          preload(f.src, { as: "image", imageSrcSet: f.srcSet, imageSizes: f.sizes });
      }
      if (prevHref && el.scrollLeft < near && !warmed.has(prevHref)) {
        warmed.add(prevHref);
        router.prefetch(prevHref);
      }
      if (warmed.size === Number(!!nextHref) + Number(!!prevHref))
        el.removeEventListener("scroll", onScroll);
    };
    // A frame on, not while the page is still being put together: read
    // then, the scroller's size forced a layout inside the arrival.
    const first = requestAnimationFrame(warm);
    /* And at most every 200ms while it scrolls, between frames rather than
       on each scroll event: read there, the two widths forced a layout on
       every frame of a swipe (1.3s of a 24s run of swipes, WebKit). */
    let soon = 0;
    const onScroll = () => {
      if (soon) return;
      soon = window.setTimeout(() => {
        soon = 0;
        warm();
      }, 200);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      window.clearTimeout(soon);
      el.removeEventListener("scroll", onScroll);
    };
  }, [router, nextHref, nextWarm, prevHref, live]);

  /* The photographs a swipe is about to bring in, ready before it does.
     A picture that comes on screen undecoded is decoded in the frame that
     shows it, and a swipe that brought in a dozen did a dozen in a row: the
     bumps in an otherwise smooth swipe on the portfolio. Once the strip has
     rested, and when the page is idle, the next two screens' pictures are
     fetched and decoded either side of where it stands. */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el || !live) return;
    let rest = 0;
    let idle = 0;
    const ahead = () => {
      const w = el.clientWidth;
      const from = el.scrollLeft - w;
      const to = el.scrollLeft + 3 * w;
      for (const img of Array.from(el.querySelectorAll<HTMLImageElement>("img"))) {
        if (img.dataset.ahead !== undefined) continue;
        const x = img.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
        if (x < from || x > to) continue;
        img.dataset.ahead = "";
        if (img.loading === "lazy") img.loading = "eager";
        img.decode().catch(() => {});
      }
    };
    const later = () => {
      window.clearTimeout(rest);
      rest = window.setTimeout(() => {
        if (typeof window.requestIdleCallback === "function") {
          window.cancelIdleCallback(idle);
          idle = window.requestIdleCallback(ahead, { timeout: 1000 });
        } else ahead();
      }, 250);
    };
    later();
    el.addEventListener("scroll", later, { passive: true });
    return () => {
      window.clearTimeout(rest);
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      el.removeEventListener("scroll", later);
    };
  }, [live, count]);

  /* Before the first paint: a deep link opens on its cell, and arriving
     backwards opens at the end with the slide coming from the left. Both
     before paint so the arrival animation is created with the right
     direction and there is never a frame of the strip somewhere else. */
  React.useLayoutEffect(() => {
    const back = nav.cameBack;
    nav.cameBack = false;
    const filtered = Date.now() - nav.filteredAt < FILTER_MS;
    nav.filteredAt = 0;
    const dealt = Date.now() - nav.dealtAt < DEAL_MS;
    nav.dealtAt = 0;
    const popped = Date.now() - nav.poppedAt < POP_MS;
    const el = scroller.current;
    if (!el || !live) return;
    /* Dealt in as a card over the strip before (`deal` in `globals.css`):
       the trip is the arrival, so nothing in here moves on its own. The
       name pairs this strip with the one leaving, for the trip only. */
    if (dealt) {
      el.dataset.arrive = "dealt";
      el.style.setProperty("view-transition-name", "strip");
      /* Undone when the trip lands, not on a clock: the deal's animations
         are read off the root while they run, so taking the way off early
         stops them where they stand. */
      const root = document.documentElement;
      const done = () => {
        el.style.removeProperty("view-transition-name");
        if (root.dataset.nav !== "deal") return;
        delete root.dataset.nav;
        delete root.dataset.navWay;
      };
      const trip = (
        document as Document & {
          activeViewTransition?: ViewTransition | null;
        }
      ).activeViewTransition;
      if (trip) trip.finished.finally(done);
      else window.setTimeout(done, 1000);
    }
    // The filter changed under a row that stayed: a fade, not an arrival.
    /* Julian: the covers fly across the filters as they do between the
       views (`flyCovers` in `lib/work-view.ts`), from where they stood
       when the chip was pressed. */
    if (filtered && flyCovers(el)) {
      el.dataset.arrive = "fly";
    } else if (filtered) {
      el.dataset.arrive = "fade";
      /* Half a screen at the very ends of the row, nothing at all for a
         press on the chip already lit. The CSS reads it; a shift of zero
         leaves the old still fade exactly as it was. */
      el.style.setProperty("--fade-from", `${(nav.filterShift * 5).toFixed(2)}vw`);
    }
    /* Back, to a path this strip has been on before: the seat it was left
       in. No animation with it — coming back to where you were is not an
       arrival, and a sequence that slid in from the right while sitting at
       its sixth cover would read as a new page that is already scrolled.
       Before the hash: on All work the hash names the discipline under
       view, written as the row scrolled, so it points at the start of a
       section the seat is already somewhere inside. */
    if (popped) {
      const seated = Number(
        (() => {
          try {
            return window.sessionStorage.getItem(
              seat(window.location.pathname),
            );
          } catch {
            return null;
          }
        })(),
      );
      if (seated > 0) {
        /* Its own word rather than "none", which is the homepage's cold
           load and keeps the cells' rise: here the cells were on screen
           a moment ago, and coming back to them is not an arrival for
           them either. `globals.css` stills both on "seat". */
        el.dataset.arrive = "seat";
        el.scrollLeft = seated;
        // So a cleanup before the first scroll read keeps this seat, not 0.
        seatX.current = seated;
        return;
      }
    }
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) {
      const i = cellFor(el, hash);
      const where = i >= 0 ? centreOf(el, i) : null;
      if (where !== null) {
        el.scrollLeft = where;
      }
    }
    /* A page zooming in or out (`page-transition.tsx` writes `data-nav`
       on the root for the trip) is the arrival; the strip sliding in from
       the side as well was three motions at once, the zoom, the cover's
       morph and the slide, measured on a recording of a cover opening. */
    const zooming =
      document.documentElement.dataset.nav === "in" ||
      document.documentElement.dataset.nav === "out";
    if (back) {
      // Dealt whole as a page (`nav-side`), the page's trip is the arrival.
      el.dataset.arrive = dealt ? "dealt" : zooming ? "zoom" : "back";
      /* The end of the sequence, not the end of the scroller. Walking
         back into a filter used to land on whatever the strip finishes
         with — which since the ask came off the discipline pages is the
         card naming the *next* project, a screen with no photograph on
         it. Julian saw that as Event coverage opening blank.

         The end first, because at this point the cells may not have been
         laid out and `offsetLeft` would read zero for all of them; then a
         frame later, when they have, back to the last cell the ruler
         counts. Both are the end of the strip, so there is nothing to
         see between them. */
      el.scrollLeft = el.scrollWidth;
      requestAnimationFrame(() => {
        const cells = Array.from(el.children) as HTMLElement[];
        const last = cells.reduce(
          (found, cell, i) => (cell.dataset.tick !== undefined ? i : found),
          -1,
        );
        const where = last >= 0 ? centreOf(el, last) : null;
        if (where === null) return;
        const at = Math.max(
          0,
          Math.min(el.scrollWidth - el.clientWidth, where),
        );
        /* A nudge off the end, never a journey: if the cells still have
           no layout the sum comes out near zero, and moving there would
           be the strip opening at the start of a sequence somebody is
           walking backwards into. */
        if (at < el.scrollLeft && at > el.scrollLeft - el.clientWidth * 1.5) {
          el.scrollLeft = at;
        }
      });
    } else if (zooming) {
      el.dataset.arrive = "zoom";
    } else if (arrive === "none") {
      el.dataset.arrive = "none";
    }
  }, [live, arrive]);

  /* The photographs arrive from the middle of the window out, the nearest
     first (Julian, 2026-10-07). After the effect above has put the strip
     where it opens, so the middle is the one the visitor sees. Not on the
     portfolio and its disciplines, which keep reading left to right;
     Motion is a page of films and takes it. */
  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || /^\/portfolio(\/(?!video)[^/]*)?$/.test(location.pathname)) return;
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    [...el.querySelectorAll<HTMLElement>(".strip-cell")]
      .map((c) => {
        const r = c.getBoundingClientRect();
        return { c, d: Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy) };
      })
      .sort((a, b) => a.d - b.d)
      .forEach(({ c }, i) => c.style.setProperty("--i", String(i)));
  }, []);

  /* ── the far cells wait for a gap ──
     Arriving on a discipline, WebKit painted the photographs two and three
     screens off as well as the ones in view, in the same frame: one block
     of 200 to 390ms on Event coverage at 1440 (2026-10-09). With the cells
     more than two screens away hidden it was 70 to 88ms. So they are,
     `visibility` and not `display`, so nothing moves, and they come back
     one at a time, nearest first, in the gaps after the page has landed,
     or all at once the moment the strip is moved. After the effect above,
     which has put the strip where it opens. A paged strip's screens are
     whole windows and stay as they are. */
  React.useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || !live || paged) return;
    const x = el.scrollLeft;
    const w = el.clientWidth;
    const far = (Array.from(el.children) as HTMLElement[])
      .map((c) => {
        const left = leftOf(c);
        const d = Math.max(left - (x + w), x - (left + c.offsetWidth));
        return { c, d };
      })
      .filter(({ c, d }) => d > w && !c.style.visibility)
      .sort((a, b) => a.d - b.d)
      .map(({ c }) => c);
    if (!far.length) return;
    for (const c of far) c.style.visibility = "hidden";
    let next = 0;
    let wait = 0;
    const idle = (fn: () => void) =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(fn, { timeout: 1000 })
        : window.setTimeout(fn, 60);
    const unwait = () => {
      if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(wait);
      window.clearTimeout(wait);
    };
    const one = () => {
      far[next++]?.style.removeProperty("visibility");
      if (next < far.length) wait = idle(one);
      else done();
    };
    const all = () => {
      unwait();
      for (; next < far.length; next++) far[next].style.removeProperty("visibility");
      done();
    };
    const moved = ["scroll", "wheel", "touchstart", "pointerdown", "keydown"];
    const done = () => {
      for (const t of moved) el.removeEventListener(t, all);
    };
    for (const t of moved) el.addEventListener(t, all, { passive: true });
    /* Not while the page is arriving (`data-nav` on the root): shown
       inside the trip, each was painted into its snapshot, and the block
       came back. Once it has landed they cost nothing to show. */
    const root = document.documentElement;
    const landed = new MutationObserver(() => {
      if (root.dataset.nav !== undefined) return;
      landed.disconnect();
      wait = idle(one);
    });
    if (root.dataset.nav === undefined) wait = idle(one);
    else landed.observe(root, { attributes: true, attributeFilter: ["data-nav"] });
    return () => {
      landed.disconnect();
      all();
    };
  }, [live, paged]);

  /** The scroll position, kept live: a cleanup cannot read it off the
      element, which is detached by then. */
  const seatX = React.useRef(0);

  /* Where this strip was when the page left, kept under the path it was
     on. The path is read when the effect is set up, not in the cleanup:
     by the time React tears a page down the address bar is already
     showing the next one. */
  React.useEffect(() => {
    if (!scroller.current || !live) return;
    const path = window.location.pathname;
    return () => {
      /* From the ref and not from the element: by the time a cleanup runs,
         React has taken the scroller out of the document, and a detached
         box reads `scrollLeft` 0 — which is how the first version of this
         faithfully remembered the beginning of every sequence. */
      try {
        window.sessionStorage.setItem(seat(path), String(seatX.current));
      } catch {
        // Private browsing. The seat is a courtesy, not a feature.
      }
    };
  }, [live]);

  React.useEffect(() => {
    const el = scroller.current;
    if (!el || !live) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const peek =
      paged && new URLSearchParams(window.location.search).get("peek") === "1";
    try {
      if (!peek && window.sessionStorage.getItem(CUE_SEEN)) return;
    } catch {
      // Private browsing. Showing it once more than it should is the
      // harmless way to be wrong about a courtesy.
    }
    // Nothing to teach on a page that does not run past its own edge.
    if (el.scrollWidth - el.clientWidth < 40) return;

    let held: ReturnType<typeof setTimeout>;
    let wait: ReturnType<typeof setTimeout>;
    let peeks: Animation[] = [];
    const watched = ["scroll", "wheel", "pointerdown", "touchstart"];
    const quit = () => {
      clearTimeout(wait);
      clearTimeout(held);
      lifted.disconnect();
      peeks.forEach((a) => a.cancel());
      setCue(false);
      for (const t of watched) el.removeEventListener(t, quit);
      window.removeEventListener("keydown", quit);
    };
    const start = () =>
      (wait = setTimeout(() => {
        try {
          window.sessionStorage.setItem(CUE_SEEN, "1");
        } catch {
          // As above.
        }
        setCue(true);
        /* Every screen, added to whatever translate it already has, and
           from script so no screen's own entrance animation is replaced. */
        if (peek)
          peeks = Array.from(el.children).map((c) =>
            c.animate(
              [
                { translate: "0px", easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
                { translate: `${-PEEK}px`, offset: 0.4, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
                { translate: "0px" },
              ],
              { duration: CUE_MS, composite: "add" },
            ),
          );
        held = setTimeout(quit, CUE_MS);
      }, CUE_WAIT));
    /* The two seconds count from the page being seen: on a first visit
       they ran out under the splash, and the cue played to nobody. */
    const root = document.documentElement;
    const lifted = new MutationObserver(() => {
      if ("intro" in root.dataset) return;
      lifted.disconnect();
      start();
    });
    if ("intro" in root.dataset)
      lifted.observe(root, { attributeFilter: ["data-intro"] });
    else start();
    for (const t of watched) el.addEventListener(t, quit, { passive: true });
    window.addEventListener("keydown", quit);
    return quit;
  }, [live, paged]);

  /* ── the wall ─────────────────────────────────────────────────
   * A discipline that is one gallery is a set of photographs of every
   * shape. The rack gives every cell the same height and takes its width
   * from the shape, so a column is as wide as the widest frame in it and
   * the narrower ones leave a ragged strip of ground beside them — the
   * gap reads as sixteen pixels in one place and ninety in the next.
   *
   * Here the column comes first: its width is chosen so that the frames
   * stacked in it come out the same width and fill the shelf exactly.
   *
   *   W = (shelf - the gaps between them) / sum(1 / ratio)
   *
   * Every gap is then the same, every photograph keeps the shape it was
   * shot at, and nothing is cropped. Only where the shelf is one gallery:
   * a run of covers is a run of covers and stays exactly as it is, which
   * is what Julian asked for.
   *
   * Written into a stylesheet of its own rather than onto the cells: the
   * cells belong to React, and a re-render puts back what it knows about.
   * ─────────────────────────────────────────────────────────────── */
  React.useLayoutEffect(() => {
    const el = scroller.current;
    // Not on a phone: the sheet there runs down the page (`globals.css`).
    if (!el || !grid || !live || !wide) return;
    const sheet = document.createElement("style");
    document.head.append(sheet);
    el.dataset.wall = wallId;

    const paint = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      const cs = getComputedStyle(el);
      const gap = parseFloat(cs.columnGap) || 16;
      const room =
        el.clientHeight -
        parseFloat(cs.paddingTop) -
        parseFloat(cs.paddingBottom);
      /* Each run of a gallery's frames is a wall of its own. A cover is a
         link and never part of one, so a run of covers stays exactly as
         it is; on All work the galleries among them are walled one by one.
         Julian saw the ragged holes in Event coverage there, where the
         wall used to stand down for the whole shelf. */
      const runs: HTMLElement[][] = [];
      for (let i = 0; i < kids.length; i++) {
        if (kids[i].tagName !== "BUTTON") continue;
        if (i > 0 && kids[i - 1].tagName === "BUTTON")
          runs[runs.length - 1].push(kids[i]);
        else runs.push([kids[i]]);
      }
      if (!runs.length || room < 80) {
        sheet.textContent = "";
        el.dispatchEvent(new Event(RELAID));
        return;
      }

      const at = `[data-wall="${wallId}"]`;
      const rules = [
        `${at}{position:relative!important;}`,
        `${at}>button{position:absolute!important;margin:0!important;aspect-ratio:auto!important;}`,
      ];
      const top0 = parseFloat(cs.paddingTop) || 0;
      for (const frames of runs) {
        const ars = frames.map(
          (f) =>
            parseFloat(getComputedStyle(f).getPropertyValue("--ar")) || 0.8,
        );
        /* Walk the run, taking at each step the number of frames whose
           shared width lands nearest the one the wall wants. */
        const cols: { at: number; k: number; w: number }[] = [];
        for (let i = 0; i < ars.length;) {
          let best = { k: 1, w: 0, score: Infinity };
          for (let k = 1; k <= 3 && i + k <= ars.length; k++) {
            const inv = ars.slice(i, i + k).reduce((sum, a) => sum + 1 / a, 0);
            const w = (room - (k - 1) * gap) / inv;
            const score =
              Math.abs(w / room - WALL_WANT) + (w / room > WALL_CAP ? 100 : 0);
            if (score < best.score) best = { k, w, score };
          }
          cols.push({ at: i, k: best.k, w: best.w });
          i += best.k;
        }

        /* The words that open the run stay where they are and keep their
           own width; the wall starts after them. Where they stand depends
           on the walls before this one, so what is written so far goes in
           first and is measured: one layout a gallery, and only when the
           shelf changes size. */
        const first = kids.indexOf(frames[0]);
        const head = first > 0 ? kids[first - 1] : null;
        sheet.textContent = rules.join(String.fromCharCode(10));
        const left0 = head
          ? leftOf(head) + head.offsetWidth + gap
          : parseFloat(cs.paddingLeft) || 0;

        let x = left0;
        for (const col of cols) {
          let y = top0;
          for (let n = 0; n < col.k; n++) {
            const h = col.w / ars[col.at + n];
            rules.push(
              `${at}>:nth-child(${kids.indexOf(frames[col.at + n]) + 1}){` +
                `left:${x.toFixed(2)}px!important;top:${y.toFixed(2)}px!important;` +
                `width:${col.w.toFixed(2)}px!important;height:${h.toFixed(2)}px!important;}`,
            );
            y += h + gap;
          }
          x += col.w + gap;
        }
        /* Out of the flow, the frames take no room, so the words that open
           the run carry the wall's length on their own margin and whatever
           follows lands after it. */
        if (head) {
          rules.push(
            `${at}>:nth-child(${first}){margin-right:${(x - left0).toFixed(2)}px!important;}`,
          );
        }
      }
      sheet.textContent = rules.join(String.fromCharCode(10));
      el.dispatchEvent(new Event(RELAID));
    };

    paint();
    const watch = new ResizeObserver(paint);
    watch.observe(el);
    return () => {
      watch.disconnect();
      sheet.remove();
      delete el.dataset.wall;
    };
  }, [grid, live, wide, count, wallId]);

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

  /* ── running a finger along the ruler ──
     Every tick is a jump already. What it was not is a thing you could
     read before you committed to it: a word appeared under a mouse, on
     ticks that had a word of their own, and a tablet has no hover at all.

     So the pointer says where it is and the release says go. Held down,
     the name under the pointer follows it along the rail; let go and the
     strip travels there. Nothing moves until then, because a rail that
     scrubbed the strip live would be the whole archive flying past under
     a thumb — and this is a map, not a shuttle.

     The word a tick shows is the word of its section, not its own. On a
     discipline page twelve of eighty four ticks carry a name; the rest
     are the covers under one, and the answer to "what is here" is the
     name of the chapter they belong to. */
  const rail = React.useRef<HTMLDivElement>(null);
  const held = React.useRef(false);
  /** Where the pointer was last seen along the rail, so a chapter that is
      still opening can be re-read without one. */
  const lastX = React.useRef<number | null>(null);
  /** The beat an open chapter is held for once the pointer has gone. */
  const linger = React.useRef(0);
  React.useEffect(() => () => window.clearTimeout(linger.current), []);
  /** For each tick, the last name at or before it. */
  const named = React.useMemo(
    () =>
      ticks.reduce<(string | undefined)[]>(
        (out, t, n) => [...out, t.word ?? out[n - 1]],
        [],
      ),
    [ticks],
  );

  /* ── the ruler in chapters ──
     Eighty four covers under twelve disciplines came out as eighty four
     ticks four pixels wide: a rail that was really a table of contents,
     drawn as a bar chart of how much work is in each pile. Julian asked
     for chapters, and then for equal ones - twelve ways of working, not
     twelve sizes of pile - with the projects appearing inside the one
     under the pointer.

     So the twelve share the width until one is asked for, and how far
     that one opens is how much is in it: Editorial's thirty three want
     room to be pointed at, Cover art's one does not. The bar is scored
     into its projects rather than beaded with them; a dot per project is
     a carousel indicator, and at thirty three of them it is a dotted
     line. */
  const chapterSegs = React.useRef<(HTMLDivElement | null)[]>([]);
  /** The runs of `named`: one chapter per section, in order. */
  const groups = React.useMemo(() => {
    const out: {
      name?: string;
      from: number;
      to: number;
      /** A chapter that is elsewhere: it holds no ticks of this page, and
          a press on it travels to that page instead of along this one. */
      href?: string;
    }[] = [];
    named.forEach((word, n) => {
      const last = out.at(-1);
      if (last && last.name === word) last.to = n;
      else out.push({ name: word, from: n, to: n });
    });
    return out;
  }, [named]);
  /** Which tick the cell in the middle belongs to, and so which chapter
      is the one being read. */
  const atTick = Math.max(0, ticks.filter((t) => t.i <= at).length - 1);
  /** Where the rail draws itself: the live reading, or the end of a
      journey the rail itself started and the pictures are still making. */
  const lands = aim ?? atTick;
  /* The archive's own chapters, where a page has been handed them. This
     strip is one of them and takes all of its ticks; the others hold
     none and stand for the pages they lead to. */
  const away = React.useMemo(() => {
    if (!map?.length || !ticks.length) return null;
    return map.map((m) =>
      m.here
        ? { name: m.name, from: 0, to: ticks.length - 1 }
        : { name: m.name, from: -1, to: -1, href: m.href },
    );
  }, [map, ticks.length]);
  const chapterList = away ?? groups;
  const desk = useDesk();
  /* Two chapters are not a table of contents, and one is a rail with a
     single segment in it. Under three the plain ruler is the better
     instrument and nothing changes. */
  const chaptered = (chapters || !!away) && desk && chapterList.length > 2;
  /** The chapter the pointer is in, or null. */
  const openAt =
    over === null
      ? null
      : chapterList.findIndex((g) => over >= g.from && over <= g.to);
  /* `open` is taken in here - it is the ref holding `onOpen` - so the
     chapter under the pointer is named for what it is. */
  const openChapter = openAt !== null && openAt >= 0 ? openAt : null;

  /** How much room a chapter takes when it opens, as a share against the
      eleven that stay shut. A floor, or a one-project chapter would open
      to nothing; a ceiling, or Editorial would take the whole rail. */
  const opening = (count: number) => Math.min(Math.max(count / 3.5, 1.4), 7);

  /** And on the archive's rail, the share the chapter you are in takes,
      whichever one it is. Julian: every chapter opens to the same width.
      Its own share would have said how much work is in it, but there is
      only ever one open here and it is the page you are standing on, so
      the reading was Portraits at 164px against Editorial at 371 - the
      rail changing shape between two filters, which is the thing this was
      built to stop. Four of the fourteen shares, which leaves the other
      ten disciplines around a hundred pixels each. */
  const OPEN_SHARE = 4;

  /** Half the gap between two chapters, and so the inset from a chapter's
      own edge to the bar drawn inside it. */
  const CHAPTER_PAD = 4;

  /** Which chapter a pointer at `x` is over. The chapters tile the rail
      with no gap between them - the gap is drawn inside each one - so
      every x on the rail belongs to exactly one of them and there is
      nowhere to fall through. */
  const chapterAt = (x: number) => {
    const box = rail.current?.getBoundingClientRect();
    if (!box || !chaptered) return null;
    const g = chapterSegs.current.findIndex((el) => {
      const r = el?.getBoundingClientRect();
      return !!r && x >= r.left && x < r.right;
    });
    return g < 0 ? (x < box.left ? 0 : chapterList.length - 1) : g;
  };

  /** Which tick a pointer at `x` is over. In plain ticks they share the
      rail's width equally and this is arithmetic. In chapters they do not
      - the one under the pointer is wider than the rest, and as often as
      not the widths are still travelling - so the chapters are asked
      where they are. Twelve rectangles a move rather than eighty four. */
  const tickAt = (x: number) => {
    const box = rail.current?.getBoundingClientRect();
    if (!box || !ticks.length) return null;
    if (!chaptered) {
      const n = Math.floor(((x - box.left) / box.width) * ticks.length);
      return Math.max(0, Math.min(ticks.length - 1, n));
    }
    const g = chapterAt(x);
    if (g === null) return null;
    const r = chapterSegs.current[g]?.getBoundingClientRect();
    const here = chapterList[g];
    // A chapter that lives on another page has no tick of this one in it.
    if (!r || !here || here.href) return null;
    const count = here.to - here.from + 1;
    const w = Math.max(1, r.width - CHAPTER_PAD * 2);
    const c = Math.floor(((x - r.left - CHAPTER_PAD) / w) * count);
    return here.from + Math.max(0, Math.min(count - 1, c));
  };

  /* A chapter opening moves the cells out from under a pointer that never
     moved, so the ruler re-reads itself while the layout is travelling.
     `setOver` with the answer it already has costs a bail-out and no
     render, so this is twelve rectangles a frame for as long as a pointer
     is on the rail and nothing else. */
  const hit = React.useRef(tickAt);
  // After the render rather than during it: the loop wants the newest hit
  // test, and a ref written mid-render is a ref read before it is set.
  React.useEffect(() => {
    hit.current = tickAt;
  });
  const onRail = over !== null;
  /** Each chapter's colour on the rail, and so its neighbours'. */
  const chapterTints = chapterList.map((g) => tintOf(ticks.slice(g.from, g.to + 1)));
  /** The chapter the page is in, for the rail at rest (`rail-sum`). */
  const nowIn = chaptered
    ? chapterList.find((g) => !g.href && lands >= g.from && lands <= g.to)
    : undefined;
  /* Its fill follows the scroll exactly (Julian): from the chapter's first
     cell in the middle of the window to its last, written by hand so a
     scroll frame costs no render. */
  const sumFill = React.useRef<HTMLSpanElement>(null);
  const sumFrom = nowIn ? ticks[nowIn.from]?.i : undefined;
  const sumTo = nowIn ? (ticks[nowIn.to + 1]?.i ?? Infinity) - 1 : undefined;
  React.useEffect(() => {
    const el = scroller.current;
    const fill = sumFill.current;
    if (!el || !fill || sumFrom === undefined || sumTo === undefined) return;
    const read = () => {
      const max = el.scrollWidth - el.clientWidth;
      const a = Math.max(0, centreOf(el, sumFrom) ?? 0);
      const b = Math.min(
        max,
        centreOf(el, Math.min(sumTo, el.children.length - 1)) ?? max,
      );
      const p = b > a ? (el.scrollLeft - a) / (b - a) : 1;
      // A clip and not a width: a width lays the rail out on every
      // scroll frame, a clip is only painted.
      fill.style.clipPath = `inset(0 ${100 - Math.min(1, Math.max(0, p)) * 100}% 0 0 round 9999px)`;
    };
    read();
    el.addEventListener("scroll", read, { passive: true });
    return () => el.removeEventListener("scroll", read);
  }, [sumFrom, sumTo]);
  /** Starts the rail's re-reading loop again, when it has stopped. */
  const wakeRail = React.useRef(() => {});
  React.useEffect(() => {
    if (!chaptered || !onRail) return;
    let frame = 0;
    /* Frames in a row in which nothing moved. A pointer left resting on
       the rail kept this loop going for as long as it stayed there, 120
       callbacks a second with nothing to do (measured on /portfolio,
       2026-10-09). Once the chapters have finished opening, which is the
       300ms of their `flex-grow` ease, it stops, and a move wakes it. */
    let calm = 0;
    let was = "";
    const step = () => {
      const x = lastX.current;
      const now = x !== null ? hit.current(x) : null;
      if (x !== null) setOver(now);
      /* A project's name is centred over its own cell, and the first cell
         of the first chapter is at the edge of the page: I WANNA BE A
         HUMAN, over Editorial's second cover, measured at -5px and lost
         its first letter off the side of the window. So the word is
         pushed back inside the rail here, where its width is known -
         a percentage in the markup cannot clamp against a word it has
         not measured. */
      const railEl = rail.current;
      const word = railEl?.querySelector<HTMLElement>("[data-word]");
      if (railEl && word) {
        const box = railEl.getBoundingClientRect();
        const seen = word.getBoundingClientRect();
        const half = seen.width / 2;
        const mid = seen.left + half;
        const want = Math.min(Math.max(mid, box.left + half), box.right - half);
        if (Math.abs(want - mid) > 0.5)
          word.style.left = `${
            parseFloat(getComputedStyle(word).left) + (want - mid)
          }px`;
      }
      /* Where every chapter stands, as the pointer and the word read it. */
      const key = `${now}:${chapterSegs.current
        .map((s) => s?.getBoundingClientRect().width.toFixed(1))
        .join(",")}`;
      calm = key === was ? calm + 1 : 0;
      was = key;
      frame = calm < 24 ? requestAnimationFrame(step) : 0;
    };
    wakeRail.current = () => {
      calm = 0;
      if (!frame) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      wakeRail.current = () => {};
    };
  }, [chaptered, onRail]);

  /** The chapter under `x` if it is another page, or null. Read on the way
      in and on the way out, so a drag that crosses one shows its name and
      a release on it goes there. */
  const awayAt = (x: number) => {
    const g = chapterAt(x);
    return g !== null && chapterList[g]?.href ? g : null;
  };

  const railDown = (e: React.PointerEvent<HTMLDivElement>) => {
    held.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    window.clearTimeout(linger.current);
    lastX.current = e.clientX;
    setOverAway(awayAt(e.clientX));
    setOver(tickAt(e.clientX));
    wakeRail.current();
  };
  const railMove = (e: React.PointerEvent<HTMLDivElement>) => {
    window.clearTimeout(linger.current);
    lastX.current = e.clientX;
    wakeRail.current();
    const n = tickAt(e.clientX);
    setOverAway(awayAt(e.clientX));
    setOver(n);
    /* Held, so the shelf comes with the pointer rather than waiting for it
       to lift. Julian: allow dragging the bold part and going through the
       filters and the pages. Until now the rail was a preview — a drag
       along it told you where you would land and never showed you what was
       there, so the one control built for travelling the whole sequence
       could only be used one press at a time.

       `glide` retargets rather than restarting: each move sets a new
       destination and the speed is recomputed from where the travel has
       actually got to, so a sweep across eleven chapters is one continuous
       journey and not eleven interrupted ones. */
    if (held.current && n !== null) goTo(ticks[n].i);
  };
  const railUp = (e: React.PointerEvent<HTMLDivElement>) => {
    /* Where the word says, not where a fresh hit test says. The rail can
       still be settling under a pointer that has only just arrived on it,
       and read again at the moment of the press it answered for whichever
       cell had slid under the finger by then: measured on All work, the
       name over the rail read FROSTBITE and the press landed on
       LIGHTBEAM. `over` is what the name is drawn from and it is re-read
       every frame, so pressing takes you to the thing you can see. */
    const n = over ?? tickAt(e.clientX);
    const g = overAway ?? awayAt(e.clientX);
    held.current = false;
    lastX.current = null;
    window.clearTimeout(linger.current);
    setOver(null);
    setOverAway(null);
    /* A chapter of the archive that is not this page: the rail is a map of
       all of them, so pressing one is how you get there. Julian asked for
       exactly that. */
    const href = g === null ? undefined : chapterList[g]?.href;
    if (href) {
      router.push(href);
      return;
    }
    // A press that never moved is a press on a tick, which is the same
    // journey: both end here rather than in the button's own `onClick`.
    if (n !== null) {
      setAim(n);
      goTo(ticks[n].i);
    }
  };
  const railOut = () => {
    if (held.current) return;
    lastX.current = null;
    /* A press shuts the chapter at once - it has been answered, and the
       strip is already travelling. A pointer merely wandering off is
       given the beat, and a plain ruler has nothing to hold open. */
    window.clearTimeout(linger.current);
    setOverAway(null);
    if (!chaptered) return setOver(null);
    linger.current = window.setTimeout(() => setOver(null), LINGER);
  };

  /** Puts a cell in the middle of the window. */
  const goTo = (i: number) => {
    const el = scroller.current;
    // The ruler moving the row is the visitor moving it: the aim is spent.
    aimed.current = "";
    const where = el ? centreOf(el, i) : null;
    if (where !== null) glide.current(where);
  };

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
      data-dwell={chaptered && over !== null ? "" : undefined}
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
           started itself — a wheel notch, a drag, a flick's momentum, a
           tick — and snap re-aims each one as it settles, which reads as
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

      {/* The panel: a tick for every cell that asked for one, the one you
          are on inked and tall, and whatever the page counts beside it.
          Each tick is a control — the strip is long and a visitor who wants
          the last cell should not have to travel the whole sequence to reach
          it. A tick with a word shows it when it is the one you are on or
          the one under the pointer. */}
      <div
        className={cn(
          // The gap has to hold a tick word: 16px did not, and the word's
          // top two pixels sat inside the strip, over the bottom edge of
          // whatever cell was there.
          /* `min-h-5`, so the row is the same height with a tick's word or
             a client's mark in it and without one. It had drifted to
             `min-h-3` and the four pixels this was written to stop were
             being given up again, with worse consequences in the rack than
             on a strip: the row sits at 16 empty and 20 with a word, the
             strip above is `flex-1` and loses the difference, and a rack
             cell takes its width from the shelf's own height. Measured on
             Brand campaigns at 2000 — the rack went 919.4 to 915.4, every
             cell 338.97 to 337.38, the scrollable extent 1287 to 1274, all
             while a wheel was moving it. The ruler was reading a length
             that changed under it, which is why two of its segments lit at
             once near the end. */
          /* And paper under the rail. Julian: leave some white space on the
             bottom. The band finished 38px off the foot of a 900px window
             and the rail read as the last thing on the page rather than as
             something sitting on it. Padding and not a taller row: the
             rack reads the shelf's own height to work out a column's
             width, so anything that changes height mid-gesture moves every
             cell under the pointer — which is the bug `min-h-5` above was
             written to stop. A constant 16px moves nothing. */
          "strip-rail mt-6 flex min-h-5 items-end gap-6 px-6 pb-4 max-sm:mt-3 sm:px-10 tablet:mt-3 lying:mt-2",
          stack && "max-sm:hidden",
        )}
        /* Julian: one big bar, sectioned off (`rail-names` in
           `globals.css`). */
        data-rail-names={chaptered ? "always" : undefined}
      >
        {counter?.(at)}
        {pageCount && !counter && ticks.length ? (
          <p aria-hidden className="strip-count label shrink-0 tabular-nums text-muted-foreground">
            <span className="text-foreground">
              {String(Math.max(1, ticks.filter((t) => t.i <= at).length)).padStart(2, "0")}
            </span>
            {" / "}
            {String(ticks.length).padStart(2, "0")}
          </p>
        ) : null}
        {/* Where you are, for a reader who cannot see the inked tick. The
            ruler beside this is a row of pointer-only jump controls and
            stays hidden from assistive tech: given a role it became a
            landmark full of unnamed buttons, measured in Chromium, which
            does not treat a progressbar's children as presentational. So
            the position is said once, here, and nothing else changes. */}
        <span
          role="progressbar"
          aria-label="Position"
          aria-valuemin={1}
          aria-valuemax={ticks.length || 1}
          aria-valuenow={Math.max(1, ticks.filter((t) => t.i <= at).length)}
          aria-valuetext={
            ticks[Math.max(1, ticks.filter((t) => t.i <= at).length) - 1]
              ?.word ??
            `${Math.max(1, ticks.filter((t) => t.i <= at).length)} of ${
              ticks.length || 1
            }`
          }
          className="sr-only"
        />
        {/* The client's mark used to sit here, drawn for whichever cover
            was in the middle. It is gone. In the rack there is no middle —
            two rows of cells go by at once and the reading picked whatever
            happened to be centred, so Julian got client logos appearing and
            swapping at random as he scrolled. A mark that names the wrong
            project is worse than no mark. The prop and the
            map that fed it are gone with it. */}

        <div
          aria-hidden
          ref={rail}
          onPointerDown={railDown}
          onPointerMove={railMove}
          onPointerUp={railUp}
          onPointerCancel={railOut}
          onPointerLeave={railOut}
          // `h-2` whether or not the ticks are in yet, so the strip above is
          // the same height before and after they are read.
          /* `touch-action: none`, or the first millimetre of a drag along
             the rail is the page deciding the gesture was a scroll and
             taking it away. `py-2` is the thumb: the rail itself is eight
             pixels tall and the padding is hit area, not height. On a
             touch screen the `::before` takes the hit area to 44px: the 12px
             gap above the rail and the 16px foot below it, without moving
             a pixel of the drawing. */
          data-cue={cue ? "" : undefined}
          /* Julian: one word at the pointer, always, and on a rail
             that word is VIEW (`pointer-mark.tsx`). The names stay on the
             rail itself. */
          data-ring={over !== null || overAway !== null ? "View" : ""}
          className={cn(
            "rail-line relative flex h-2 min-w-0 flex-1 touch-none items-end py-2",
            "pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-top-3 pointer-coarse:before:-bottom-4 pointer-coarse:before:content-['']",
            // In chapters the gap is drawn inside each one, so the twelve
            // tile the rail and the hit test has nowhere to fall through.
            chaptered ? "gap-0" : "justify-between gap-px",
          )}
        >
          {/* Hit area, and nothing else. The rail is sixteen pixels of
              line and Julian said it was hard to stay on one: a mouse
              running along it sideways drifts off it upwards and the
              chapter under it shuts. So the band reaches up into the
              twenty four pixels of empty gap above the rail - the
              covers end exactly there, and it takes none of them - and
              eight pixels into the footer's own padding below, which is
              blank. Sixteen pixels becomes forty eight and not one thing
              on the page moves.

              A descendant of the rail rather than a sibling, so leaving
              the rail's own box for it is not leaving the rail:
              `pointerleave` counts an element and its descendants as one
              place. Chapters only, where the pointer is a mouse - on a
              tablet this would be a strip of page that swallows a swipe
              on its way past. */}
          {chaptered ? (
            <span
              aria-hidden
              className="absolute -bottom-2 -top-6 left-0 right-0 z-10"
            />
          ) : null}
          {/* The drop, on every rail but the archive's (Julian put that
              one back as it was). */}
          {chaptered ? null : <RailInk rail={rail} />}
          {/* Julian: unhovered, the archive's rail is About's one line,
              filled as far as the page has got through the discipline it
              is in. The line is the sections themselves, shrunk; this is
              only the fill and the name over them (`rail-sum` in
              `globals.css`). */}
          {nowIn ? (
            <span
              aria-hidden
              className="rail-sum pointer-events-none absolute inset-x-0 top-0 z-[1] h-2 rounded-full"
            >
              <span
                ref={sumFill}
                className="block h-full w-full rounded-full bg-foreground [clip-path:inset(0_100%_0_0)]"
              />
              <span className="rail-word label absolute bottom-full left-0 mb-2 whitespace-nowrap text-muted-foreground">
                {nowIn.name}
              </span>
            </span>
          ) : null}
          {chaptered
            ? chapterList.map((g, gi) => {
                const count = g.to - g.from + 1;
                const here = lands >= g.from && lands <= g.to;
                /* The chapter you are standing in is open from the start
                   rather than on being pointed at. Shut, it said which
                   discipline you were in and nothing about where in it:
                   Julian asked for an indicator inside the rail showing
                   the position on the page, and a chapter has to be open
                   before a position can be marked in it.

                   But not while a pointer is on the rail. The open
                   chapter follows the page, so a rail that kept following
                   it changed shape between aiming at a project and
                   pressing it: measured on All work, a press on ÆGIS
                   while the rail was still settling landed on ASTRAL
                   ALLURE, four cells away. On the rail, the pointer is
                   the only thing that opens a chapter, and what you see
                   is what you press. */
                /* A filter's rail is exempt: its one chapter with work
                   in it never changes as the page runs, so there is
                   nothing to pulse and the position stays readable while
                   you scroll. */
                const mine =
                  here &&
                  !g.href &&
                  !onRail &&
                  (!!away || still || aim !== null);
                const shown = openChapter === gi || mine;
                /* Which cell of an open chapter carries the ink: the one
                   under the pointer where the pointer is in this chapter,
                   and otherwise where the page stands. So your own
                   chapter keeps its place while another is being read. */
                const mark =
                  over !== null && over >= g.from && over <= g.to
                    ? over
                    : mine
                      ? lands
                      : null;
                /* Words in the back half hang from the right of their
                   chapter and grow leftwards, as the ticks' own did: a
                   long one near the end ran past the edge of the window. */
                const end = gi * 2 >= chapterList.length;
                /* The chapter names itself until one of its projects is
                   under the pointer, and then the project has the slot.
                   One word above one chapter, never two competing for the
                   same inch of line. */
                const named1 = shown && over !== null;
                const word = named1 ? (ticks[over].name ?? g.name) : g.name;
                return (
                  <div
                    /* Every chapter away from this page starts at -1, so
                       those are told apart by where they lead. */
                    key={`chapter-${g.href ?? g.from}`}
                    ref={(el) => {
                      chapterSegs.current[gi] = el;
                    }}
                    style={
                      {
                        flexGrow: shown
                          ? mine
                            ? OPEN_SHARE
                            : opening(count)
                          : 1,
                        /* Each stretch runs into its neighbours' colours
                           at its edges, so the bar is one blend (Julian:
                           smooth). */
                        "--tint": chapterTints[gi],
                        "--tint-prev": chapterTints[gi - 1] ?? chapterTints[gi],
                        "--tint-next": chapterTints[gi + 1] ?? chapterTints[gi],
                      } as React.CSSProperties
                    }
                    /* Which thumb it carries in the control
                       (`globals.css`): where you are, or a discipline
                       elsewhere under the pointer. */
                    data-tone={
                      shown
                        ? "open"
                        : here
                          ? "lit"
                          : overAway === gi
                            ? "near"
                            : undefined
                    }
                    className={cn(
                      "rail-chapter relative flex h-2 min-w-0 shrink basis-0 items-end px-1",
                      /* Eased while the page is what moves it, instant
                         while a pointer is on it. Three hundred
                         milliseconds of growth under a finger is three
                         hundred milliseconds in which the cell being
                         aimed at slides away: the name over the rail read
                         FROSTBITE and the press landed on LIGHTBEAM, and
                         a press near the left edge of a chapter that was
                         still opening landed on the first project of it,
                         which is what Julian saw. Opened at once, the
                         rail is still before it is aimed at. */
                      !onRail &&
                        "transition-[flex-grow] duration-300 ease-[var(--ease-out-strong)]",
                    )}
                  >
                    {word ? (
                      <span
                        /* A project's name stands over the project, not
                           over the left edge of the chapter it is in: the
                           word is pointing at something and should point
                           at it. The chapter's own name keeps the ticks'
                           old anchoring. */
                        data-word={named1 ? "" : undefined}
                        style={
                          named1
                            ? {
                                left: `${((over - g.from + 0.5) / count) * 100}%`,
                              }
                            : undefined
                        }
                        className={cn(
                          /* `mb-2`, not `mb-1`. Julian: put some space
                             between the rail and the word that comes up
                             over it. Four pixels had the word sitting on
                             the bars, so a long title read as one object
                             with the graphic under it. Eight separates
                             them and still clears the covers: the word
                             rises into the 24px above the rail, and at
                             twelve pixels plus eight it reaches 20 with
                             four to spare. */
                          "rail-word label pointer-events-none absolute bottom-full mb-2 whitespace-nowrap transition-opacity duration-200",
                          /* The word grows by a scale (globals.css), so
                             it grows from the edge it is pinned to. */
                          named1
                            ? "origin-bottom [translate:-50%_0]"
                            : end
                              ? "origin-bottom-right right-1"
                              : "origin-bottom-left left-1",
                          shown
                            ? "text-foreground opacity-100"
                            : /* A discipline the pointer is running along
                                 on its way somewhere else says its name,
                                 because its name is the whole of what it
                                 offers: it is a door, not a chapter of
                                 this page. */
                              overAway === gi
                              ? "text-foreground opacity-100"
                              : over !== null || overAway !== null
                                ? "text-muted-foreground opacity-0"
                                : here
                                  ? "text-muted-foreground opacity-100"
                                  : "text-muted-foreground opacity-0",
                        )}
                      >
                        {word}
                      </span>
                    ) : null}
                    {/* Open, the chapter drops back to the middle tone -
                        the one you are standing in included. Once it is
                        open the ink means the project under the pointer,
                        and a bar that is already solid has nothing left to
                        say with it. */}
                    <div
                      className={cn(
                        /* Always the full eight pixels tall and scaled
                           down from the bottom, rather than a height that
                           moves: a height tween lays the whole rail out
                           again on every frame, a scale is drawn by the
                           compositor. */
                        "rail-bar flex h-2 w-full origin-bottom rounded-full transition-[scale,background-color] duration-200 ease-[var(--ease-out-strong)]",
                        shown
                          ? /* The cue nudges the bar that says where you
                               are, and on the archive's rail that is this
                               open chapter rather than a lit one. */
                            cn(
                              "scale-y-100 bg-foreground/25",
                              mine && "rail-lit",
                            )
                          : here
                            ? "rail-lit scale-y-50 bg-foreground"
                            : overAway === gi
                              ? "scale-y-75 bg-foreground/40"
                              : "scale-y-50 bg-foreground/20",
                      )}
                    >
                      {Array.from({ length: count }, (_, k) => (
                        <span
                          key={`cell-${g.from + k}`}
                          className={cn(
                            /* The mark moves without easing its colour.
                               Eased both ways, a fast scroll left a trail
                               of half-lit cells behind it: Julian's
                               recording showed two at once. */
                            "h-full min-w-0 flex-1 transition-[box-shadow] duration-200 ease-[var(--ease-out-strong)]",

                            k === 0 && "rounded-l-full",
                            k === count - 1 && "rounded-r-full",
                            // A cut the colour of the page, not a gap and
                            // not a dot: the chapter stays one bar and is
                            // scored into the work inside it.
                            shown &&
                              k < count - 1 &&
                              "shadow-[inset_-1px_0_0_0_var(--background)]",
                            shown && mark === g.from + k && "bg-foreground",
                          )}
                          style={{ "--tint": ticks[g.from + k]?.tint } as React.CSSProperties}
                        />
                      ))}
                    </div>
                    {/* Julian: the discipline inside its own section, or
                        the project under the pointer in an open one
                        (`rail-name`, `globals.css`). */}
                    <span aria-hidden className="rail-name label">
                      {word}
                    </span>
                  </div>
                );
              })
            : ticks.map(({ i }, n) => {
                /* Words in the back half hang from the right of their tick and
               grow leftwards. Anchored left like the rest, a long one near
               the end ran past the edge of the window — and a page that can
               be scrolled sideways by ten pixels is a page that wobbles. */
                const end = n * 2 >= ticks.length;
                return (
                  <button
                    key={`tick-${i}`}
                    type="button"
                    tabIndex={-1}
                    /* Never pressed nor reached by Tab, so not read out as
                       a row of nameless buttons either. */
                    aria-hidden
                    title={named[n]}
                    // The rail above takes the press, so this is a target and
                    // not a handler: two of them would travel twice.
                    className="group pointer-events-none relative flex h-2 flex-1 items-end"
                  >
                    {named[n] ? (
                      <span
                        className={cn(
                          "rail-tick-word label pointer-events-none absolute bottom-full mb-1 whitespace-nowrap text-[0.625rem] transition-opacity duration-200",
                          end ? "right-0" : "left-0",
                          over === n
                            ? "text-foreground opacity-100"
                            : over !== null
                              ? "text-muted-foreground opacity-0"
                              : i === at
                                ? "text-muted-foreground opacity-100"
                                : "text-muted-foreground opacity-0",
                        )}
                      >
                        {named[n]}
                      </span>
                    ) : null}
                    <span
                      data-ink={i === at ? "" : undefined}
                      className={cn(
                        /* The position moves from tick to tick without easing
                       its colour, and only the lit tick's height eases up.
                       With the colour easing over 200ms both ways a fast
                       scroll lit several at a time, the ghosts Julian
                       recorded on NOVA reading 03 and 09 together. */
                        "block h-2 w-full origin-bottom rounded-full ease-[var(--ease-out-strong)]",
                        i === at
                          ? "rail-lit scale-y-100 bg-foreground transition-[scale] duration-150"
                          : over === n
                            ? "scale-y-75 bg-foreground/40 transition-[scale,background-color] duration-200"
                            : "scale-y-50 bg-foreground/20",
                      )}
                    />
                  </button>
                );
              })}
        </div>
      </div>
    </div>
  );
}

/** A discipline's colour on the rail: the most saturated of its
    projects' accents (`scripts/make-accents.mjs`). */
const tintOf = (cells: { tint?: string }[]) => {
  const sat = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return Math.max(...c) - Math.min(...c);
  };
  let best: string | undefined;
  for (const { tint } of cells)
    if (tint && (!best || sat(tint) > sat(best))) best = tint;
  return best;
};

/* ── the ink in liquid ──
   Julian: the gooey UI in the scrollbar, sitewide. Where you are on the
   rail is a drop of the ink (`liquid-gooey`, Move): it sits over the lit
   tick (`data-ink`), and when that moves the drop runs after
   it, stretching and trailing a droplet. The lit mark gives up its own
   ink while the drop is there (`data-goo`, `globals.css`), so there is
   one mark and not two. Read after every render of the strip and for a
   beat after, since a chapter opening and the cue move the mark without
   one. Not for anybody who asked for less motion: the plain ink stays. */
function RailInk({ rail }: { rail: React.RefObject<HTMLDivElement | null> }) {
  const box = React.useRef<HTMLSpanElement>(null);
  const quiet = useQuiet();
  const [ink, setInk] = React.useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  React.useEffect(() => {
    const r = rail.current;
    const b = box.current;
    if (!r || !b) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const until = performance.now() + 950;
    const read = () => {
      const el = r.querySelector<HTMLElement>("[data-ink]");
      if (!el) {
        delete r.dataset.goo;
        setInk(null);
        return;
      }
      const a = el.getBoundingClientRect();
      const o = b.getBoundingClientRect();
      const next = {
        x: a.left - o.left,
        y: a.top - o.top,
        w: a.width,
        h: a.height,
      };
      setInk((p) =>
        p &&
        Math.abs(p.x - next.x) +
          Math.abs(p.y - next.y) +
          Math.abs(p.w - next.w) +
          Math.abs(p.h - next.h) <
          0.5
          ? p
          : next,
      );
      r.dataset.goo = "";
      if (performance.now() < until) raf = requestAnimationFrame(read);
    };
    /* A frame on, not here: read inside the effect, a drop that moved on
       every render set state on every render, and a fling on All work
       ran React out of nested updates. */
    raf = requestAnimationFrame(read);
    return () => cancelAnimationFrame(raf);
  });
  React.useEffect(() => () => void delete rail.current?.dataset.goo, [rail]);
  return (
    <span
      ref={box}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[5]"
    >
      {ink && quiet ? (
        /* A blur of two: the lit chapter is four pixels tall, and any
           more ate it down to a wobbling thread. */
        <Liquid
          blur={2}
          contrast={18}
          fill="var(--foreground)"
          className="h-full w-full"
        >
          {/* Julian: less bounce, as the filter bar's. */}
          <Liquid.Item effect="move" move={{ wobble: 0.25 }}>
            <div
              /* The drop springs to where the mark is and only then
                 changes size: a chapter shutting took the width at once
                 and smeared a bar across the rail. */
              className="absolute left-0 top-0 rounded-full transition-[width,height] duration-300 ease-[var(--ease-out-strong)]"
              style={{
                width: ink.w,
                height: ink.h,
                transform: `translate(${ink.x}px, ${ink.y}px)`,
              }}
            />
          </Liquid.Item>
        </Liquid>
      ) : null}
    </span>
  );
}
