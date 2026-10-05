"use client";

import { openFrom } from "@/components/lead-window";
import { runDeck, type Deck } from "@/lib/deck";
import * as React from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { cn, filterPaths, rubberband, STRIP_SECTION } from "@/lib/utils";
import { flyCovers } from "@/lib/work-view";
import { Liquid, useQuiet } from "@/components/liquid";

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
};

/** Set by a strip on its way out backwards and read by the next one on its
    way in, so the previous sequence arrives from the left and opens at its
    end, which is the side the visitor came in by. Module state rather than
    storage: it only has to survive one client navigation. */
let cameBack = false;
/** Which way the last strip led on, so the next one can tell the tail of
    that push from a new one. Never cleared: the window it is read in is
    the second after the strip mounts, and a cold load has nothing set. */
let arriveDir: 1 | -1 | 0 = 0;

/* ── a filter change, and a way back to your seat ─────────────────
 * Two more things a strip wants to know about how it got here, both
 * module state for the same reason `cameBack` is: they have to survive
 * one client navigation and nothing more.
 */

/** When a filter chip was last pressed, and which way along the row it
    was from the chip that was lit. A strip mounting just after one fades
    in where it stands rather than sliding in from a quarter of the window:
    the filter row is above it and did not move, so the sequence under it
    changing is not a page arriving.

    The direction is the whole of what Julian asked for: press a chip to the
    right of the one that is lit and the new sequence comes in from the
    right, as though the row and the work under it were one thing you were
    moving along. `shift` is how far along the row the press was, as a share
    of the row's width, so a neighbour slides a little and a chip at the far
    end slides the most. */
let filteredAt = 0;
let filterShift = 0;
export const markFilter = (shift = 0) => {
  filteredAt = Date.now();
  filterShift = Math.max(-1, Math.min(1, shift));
};
// Read once by the strip that mounts next, so it can wait out a slow page.
const FILTER_MS = 10000;
/** When a strip last led on as a card (`deck="leads"`): the strip that
    mounts next is the card, and names itself for the trip. Generous,
    because the next page can take seconds to come in (a cold Worker, a
    route compiling on dev) and the deal has to survive the wait. It used
    to be a second and a half, and a slow page lost the deal: the strip
    froze and the next one popped in. Julian saw it often. */
let dealtAt = 0;
const DEAL_MS = 10000;

/** When the browser last went back or forward. A strip mounting just
    after one puts the visitor back where they were on this path instead
    of at the beginning: leaving Portraits five covers in to look at one
    project and returning to the first cover is losing somebody's place in
    a sequence they were reading. */
let poppedAt = 0;
const POP_MS = 1500;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    // Not the photo viewer closing on the back button (`lib/zoom.ts`).
    if (document.documentElement.dataset.viewer === undefined)
      poppedAt = Date.now();
  });
}
/** Where a path's strip was when it was last left. */
const seat = (path: string) => `strip-at:${path}`;

/** Whether the app has hydrated: a strip mounting before then is the
    server's markup and must match it whole; one mounting after is a
    navigation and may hold its far cells back (`defer`). */
let hydrated = false;
/** The cells a deferring strip mounts with: up to the third section. */
const SECTIONS_FIRST = 2;
/** When a press last went to a place inside a page (`/#about`): the strip
    that mounts for it is whole, since the address it is read from still
    holds the page being left while it renders. */
let aimedAt = 0;
if (typeof window !== "undefined") {
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
      if (a && a.origin === location.origin && a.hash) aimedAt = Date.now();
    },
    true,
  );
}

/** How far past the end a wheel has to push before it leads on, in px of
    wheel delta. Three notches on a mouse: an overshoot of one is a
    reader arriving at the end, not asking to leave it. */
/** Fired on the scroller when the rack has laid its frames out again. */
const RELAID = "strip-relaid";
const LEAVE_AFTER = 300;
/* A finger's pull past the end before the strip leads on. Shorter than
   the wheel's, because a wheel notch is worth tens of pixels and a finger
   is worth the distance it actually moved: 80px is a deliberate pull and
   not the last inch of a flick that happened to land on the end. */
const LEAVE_TOUCH = 80;

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

/** Lenis, on for everyone. It carries the wheel on every sequence that
    runs sideways; `?lenis=0` turns it off for this browser and every page
    after it, and `?lenis=1` turns it back on. Read at the moment an effect
    runs rather than held in state, so the markup is the same either way
    and nothing has to hydrate around it. A browser that refuses storage
    gets it too: the default is the site, not the fallback. */
const LENIS_KEY = "strip-lenis";
function wantsLenis() {
  try {
    const asked = new URLSearchParams(window.location.search).get("lenis");
    if (asked === "1" || asked === "0")
      window.localStorage.setItem(LENIS_KEY, asked);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return false;
    return window.localStorage.getItem(LENIS_KEY) !== "0";
  } catch {
    return true;
  }
}
/** The quiet that ends a swipe. A trackpad fires every frame or so while
    the fingers are down and keeps firing as the fling decays, so anything
    under about a tenth of a second is still the same push. */
const GESTURE_GAP_MS = 120;
/** A wheel and a pointer, where a paged strip rides Lenis (`strip.tsx`). */
const WHEELED = "(hover: hover) and (pointer: fine)";
/** How long a push is held after the last notch before it starts to drain,
    so the notches of a steady spin add up rather than leak away between
    them: a notched wheel fires about ten times a second, and a drain that
    ran through the gaps levelled a spin off short of LEAVE_AFTER. Then
    RELAX is the spring: the time in which the held push falls to a third
    once the hand has stopped. Fast, because a band that takes a second to
    come back reads as the page being stuck, not as give. */
const HOLD = 200;
const RELAX = 120;
/** The most the band ever shows, in px. Resistance, not travel. */
const STRETCH = 160;
/** How far a wheel event carries the strip, as a multiple of its delta.
    Two gains, because a mouse and a trackpad are not the same instrument:
    a mouse notch is a hundred px of delta in one event, a trackpad's swipe
    is dozens of small ones. A sequence is four to nine thousand px wide,
    and at one to one a mouse took forty notches to cross it; at 1.8 Julian
    still said the pages took too long to scroll through on a mouse. So a
    notch carries three times its delta and a trackpad's events under it
    keep the gentler gain. The band's count stays in raw delta, so neither
    makes leaving any easier. */
const WHEEL = 3;
const PAD = 1.8;
/** Lenis's ease per frame for each: a notch glides, a trackpad follows.
    A notch was 0.08, which took about 460ms to cover nine tenths of its
    travel and read as lag even at a full frame rate (Julian: the portfolio
    is laggy on a desktop); 0.13 takes about 270. */
const MOUSE_LERP = 0.13;
const PAD_LERP = 0.2;

/** How long after the strip stops before the rail takes the shape of the
    chapter you have landed in. The shape follows the page, and reshaping
    it on the way past a chapter is a pulse rather than a reading: Mixed
    media is four projects and Portraits five, so on All work each is the
    chapter you are in for about four hundred milliseconds against the
    three hundred the growing takes - it had not finished opening before
    it began to shut. Julian saw it on exactly those two. While the strip
    runs the rail is eleven equal chapters with the one you are in lit,
    and it opens once you have arrived. */
const REST = 200;
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

/** Where a cell sits in layout. A cell dealt as a deck (`lib/deck.ts`) is
    `position: sticky`, and Chrome folds the sticky offset into a stuck
    cell's `offsetLeft`, so a pinned cover read as sitting exactly where
    the screen over it did and the paging never moved on. The deck stamps
    the layout position on the cell; the rest read `offsetLeft`. */
const leftOf = (cell: HTMLElement) =>
  cell.dataset.at !== undefined ? Number(cell.dataset.at) : cell.offsetLeft;

/** The scroll position that puts cell `i` in the middle of the window. */
const centreOf = (el: HTMLElement, i: number) => {
  const cell = el.children[i] as HTMLElement | undefined;
  if (!cell) return null;
  /* The homepage's last screen, narrowed for the window into the work
     beside it (`lead-window.tsx`): flush left, so the two fill the
     screen between them. Centred, the window was half off it. */
  if (cell.nextElementSibling?.hasAttribute("data-lead-window"))
    return leftOf(cell);
  const centre = leftOf(cell) - (el.clientWidth - cell.offsetWidth) / 2;
  /* No further than where its chapter holds (`lib/deck.ts`): past that
     the next chapter slides over the screen, and the last cell of one
     came up half under the next title (Julian: /portfolio#wrapped-up). */
  let next = cell.nextElementSibling as HTMLElement | null;
  while (next && !next.hasAttribute("data-deck")) next = next.nextElementSibling as HTMLElement | null;
  return next ? Math.min(centre, leftOf(next) - el.clientWidth) : centre;
};

/**
 * Which cell a hash names.
 *
 * A cell's own `data-hash` first, and failing that any `data-hash` or `id`
 * inside one: a page's sections are not always cells — the studio's ask and
 * its client list live inside the screen they belong to, and `/legal` is a
 * column of headings — and a hash that names one of those should still bring
 * the cell holding it into view rather than doing nothing at all.
 *
 * Last, a photograph by its file: `/portfolio/nyx#photo-06` opens on
 * `/work/nyx/06.jpg` wherever it sits in the sequence. The colour panel
 * links that way, because a position would move whenever a project's
 * opener changes and a file name does not.
 */
const cellFor = (el: HTMLElement, hash: string): number => {
  if (!hash) return -1;
  const cells = Array.from(el.children) as HTMLElement[];
  const own = cells.findIndex((c) => c.dataset.hash === hash);
  if (own >= 0) return own;
  const safe = CSS.escape(hash);
  const held = cells.findIndex(
    (c) => c.querySelector(`[data-hash="${safe}"], #${safe}`) !== null,
  );
  if (held >= 0 || !hash.startsWith("photo-")) return held;
  const file = CSS.escape(`/${hash.slice(6)}.jpg`);
  return cells.findIndex(
    (c) => c.querySelector(`[data-frame$="${file}"]`) !== null,
  );
};

export function Strip({
  children,
  label,
  next,
  prev,
  onOpen,
  counter,
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
    !defer || !hydrated || Date.now() - poppedAt < POP_MS || Date.now() - aimedAt < POP_MS
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
    hydrated = true;
  }, []);
  /* For the wheel, whose effect must not run again as sections arrive. */
  const heldBack = React.useRef(false);
  React.useEffect(() => {
    heldBack.current = holding;
  }, [holding]);
  React.useEffect(() => {
    const el = scroller.current;
    if (!deck || !el) return;
    return runDeck(el, deck);
    // Dealt again as each held-back section arrives.
  }, [deck, shown]);
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
  const [ticks, setTicks] = React.useState<
    { i: number; word?: string; name?: string }[]
  >([]);
  const tickKey = React.useRef("");
  // For the keyboard, which lives in an effect and must not go stale.
  const atRef = React.useRef(0);
  const wide = useWide();
  const view = React.useContext(StripView);
  const grid = view === "grid";
  /* The machine runs in both views. The sheet is a rack - two rows deep,
     running sideways - and not a page of its own that scrolls downwards:
     Julian asked for the grid to be horizontal too, and the version that
     scrolled down had to switch the wheel, the drag, the ruler and the
     lead-on off to do it, which is most of what made changing a filter
     feel like changing pages. Same gestures, twice the work on screen. */
  const live = stack ? wide : true;

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
    if (!grid) {
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
  }, [grid, shown]);
  const router = useRouter();
  // Stable for the life of the strip: pages key it by what it shows.
  const nextHref = next?.href;
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
      }
      if (prevHref && el.scrollLeft < near && !warmed.has(prevHref)) {
        warmed.add(prevHref);
        router.prefetch(prevHref);
      }
      if (warmed.size === Number(!!nextHref) + Number(!!prevHref))
        el.removeEventListener("scroll", warm);
    };
    // A frame on, not while the page is still being put together: read
    // then, the scroller's size forced a layout inside the arrival.
    const first = requestAnimationFrame(warm);
    el.addEventListener("scroll", warm, { passive: true });
    return () => {
      cancelAnimationFrame(first);
      el.removeEventListener("scroll", warm);
    };
  }, [router, nextHref, prevHref, live]);

  /* Before the first paint: a deep link opens on its cell, and arriving
     backwards opens at the end with the slide coming from the left. Both
     before paint so the arrival animation is created with the right
     direction and there is never a frame of the strip somewhere else. */
  React.useLayoutEffect(() => {
    const back = cameBack;
    cameBack = false;
    const filtered = Date.now() - filteredAt < FILTER_MS;
    filteredAt = 0;
    const dealt = Date.now() - dealtAt < DEAL_MS;
    dealtAt = 0;
    const popped = Date.now() - poppedAt < POP_MS;
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
      el.style.setProperty("--fade-from", `${(filterShift * 5).toFixed(2)}vw`);
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

  /* ── Lenis ────────────────────────────────────────────────────
   * On by default; `?lenis=0` opts a browser out. It takes the wheel on
   * the strip's own scroller, sideways, and leaves the drag, the rail,
   * the keys and the lead-on where they are. Loaded on its own, so it
   * arrives after the pictures rather than ahead of them.
   *
   * A paged strip (the homepage, the studio, the contact page) once kept
   * off it: Lenis made each one continuous scroll that slid the next
   * section into view instead of landing on it, and Julian reported
   * exactly that. They paged instead, a timed slide set off by the
   * gesture, which meant the stack moved after the wheel rather than with
   * it (Julian: make it happen with the scroll). So under a wheel they
   * have Lenis too, and land by `settle` below: the screens follow the
   * wheel, and once it rests the strip carries on to the next screen or
   * goes back to the one it left. A finger keeps the browser's snap. */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el || !live || !wantsLenis()) return;
    if (paged && !matchMedia(WHEELED).matches) return;
    let off = () => {};
    let gone = false;
    /* A frame on: Lenis measures the wrapper as it is made, and made while
       the page arrives that was 18ms of layout inside the trip's freeze. */
    const ready = new Promise((go) => requestAnimationFrame(go));
    Promise.all([import("lenis"), ready]).then(([{ default: Lenis }]) => {
      if (gone) return;
      // The notch being judged, for `prevent` below.
      let dx = 0;
      let dy = 0;
      const lenis = new Lenis({
        wrapper: el,
        content: el,
        orientation: "horizontal",
        /* A wheel and a trackpad push downwards on a page that runs
           sideways, so both axes have to count. */
        gestureOrientation: "both",
        smoothWheel: true,
        /* A box that scrolls on its own (the contact form on a laptop) keeps
           the wheel until it has run out, as the strip's own wheel lets it.
           Without this Lenis took the wheel over the form and moved nothing,
           and the send button under the fold could not be reached.

           By the strip's own rule (`onWheel`): a textarea or a select keeps
           it, a `[data-scroll]` box until it has run out. Not Lenis's
           `allowNestedScroll`, which read the computed style of everything
           under the pointer and laid the page out again for it: 20 to 35ms
           on the first notch of a push on the portfolio, the lag into the
           way back home (scroll-craft pass, 2026-10-02). */
        prevent: (node) => {
          if (Math.abs(dx) > Math.abs(dy)) return false;
          if (node.matches("textarea, select")) return true;
          if (!node.hasAttribute("data-scroll")) return false;
          return dy < 0
            ? node.scrollTop > 0
            : node.scrollTop + node.clientHeight < node.scrollHeight - 1;
        },
        /* The same gain the strip's own model uses, so what is being
           judged is the easing and not how far a notch carries: at one to
           one a notch moved 120px against 360 and Lenis would lose on a
           difference nobody asked about. */
        wheelMultiplier: WHEEL,
        /* A notch and a trackpad are not the same gesture, and Lenis
           treated them as one: a trackpad got the mouse's gain of three
           on top of its own momentum, eased again, which is twitchy under
           the finger and floaty after it. Measured per event, the way the
           strip's own model tells them apart: a notch is a delta of 80 or
           more (or a line or a page), anything finer is a trackpad. The
           trackpad keeps its gentler gain and a quick ease that follows
           its own momentum; a notch gets a longer ease so a spin reads as
           one movement rather than a pulse per notch. */
        virtualScroll: (data) => {
          const e = data.event;
          dx = data.deltaX;
          dy = data.deltaY;
          if (!(e instanceof WheelEvent)) return true;
          /* In device pixels: at 200% Chrome can report a notch as 50,
             under the line, and it was eased as a trackpad. */
          const raw =
            Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY)) *
            (window.devicePixelRatio || 1);
          const notch = e.deltaMode !== 0 || raw >= 80;
          lenis.options.lerp = notch ? MOUSE_LERP : PAD_LERP;
          if (!notch) {
            data.deltaX *= PAD / WHEEL;
            data.deltaY *= PAD / WHEEL;
          }
          return true;
        },
        /* Not the finger. An iPad's own momentum is better than anything
           here, and Lenis says its touch sync is unstable on older iOS. */
        syncTouch: false,
        /* Driven here rather than by `autoRaf`, which asks for a frame
           every frame for the life of the page, so a strip nobody touches
           never lets the main thread sleep. The loop runs while an ease is
           travelling and stops when it lands; a wheel wakes it. */
        autoRaf: false,
      });
      let frame = 0;
      /* Lenis is fed its own clock, which never moves more than two
         frames at once. It eases by the time since the frame before, and
         the first frame after a rest can carry a stale stamp: measured on
         /work, a notch's first frame arrived 3ms after the one before it
         stamped 67ms later, and Lenis spent the whole of that at once:
         82px of a 300px notch in one frame, then 17. The jump at the
         start of every scroll. */
      let clock = 0;
      let seen = 0;
      const loop = (t: number) => {
        clock += seen ? Math.min(t - seen, 34) : 0;
        seen = t;
        lenis.raf(clock);
        frame =
          lenis.isScrolling === "smooth" ? requestAnimationFrame(loop) : 0;
      };
      const wake = () => {
        if (frame) return;
        /* A new run: its first frame is a start, not a step, so nothing
           is carried over from the rest. */
        seen = 0;
        lenis.time = clock;
        frame = requestAnimationFrame(loop);
      };
      /* ── landing, on a paged strip ──
         Once the wheel has been still for a moment, the strip goes on to
         the next screen if it has come a fifth of the way towards it, and
         back to the one it left if not: a single notch turns the page, and
         a nudge the other way is taken back. Screens are measured end to
         end off their widths, since the deck pins them where they are. */
      let rest = 0;
      /* Judged by where Lenis is heading, not where it has got to: the
         ease after a notch runs on for a second, and waiting it out put
         the landing back after the wheel. */
      const settle = () => {
        const cs = getComputedStyle(el);
        const gap = parseFloat(cs.columnGap) || 0;
        const end = el.scrollWidth - el.clientWidth;
        const stops: number[] = [];
        let at = parseFloat(cs.paddingLeft) || 0;
        for (const k of Array.from(el.children) as HTMLElement[]) {
          stops.push(Math.min(end, at));
          at += k.offsetWidth + gap;
        }
        if (!stops.length) return;
        const x = lenis.targetScroll;
        let i = 0;
        while (i < stops.length - 1 && stops[i + 1] <= x) i++;
        const from = stops[i];
        const to = stops[Math.min(i + 1, stops.length - 1)];
        const gone = to > from ? (x - from) / (to - from) : 0;
        const onward = lenis.direction >= 0 ? gone > 0.2 : gone > 0.8;
        const target = onward ? to : from;
        if (Math.abs(target - x) < 1 && Math.abs(target - el.scrollLeft) < 1) return;
        lenis.scrollTo(target, {
          duration: 0.6,
          easing: (t) => 1 - (1 - t) ** 3,
        });
        wake();
      };
      const onRest = () => {
        window.clearTimeout(rest);
        rest = window.setTimeout(settle, GESTURE_GAP_MS + 20);
      };
      if (paged) el.addEventListener("wheel", onRest, { passive: true });
      // Capture, so the wake is booked before Lenis handles the event.
      el.addEventListener("wheel", wake, { capture: true, passive: true });
      /* Lenis watches the strip's box, not how far it scrolls, so the
         sections that arrive after a crossing (`defer`) never reached it:
         the wheel stopped at the second screen (Julian, 2026-10-02). */
      const grown = new MutationObserver(() => lenis.resize());
      grown.observe(el, { childList: true });
      el.dataset.lenis = "1";
      off = () => {
        grown.disconnect();
        cancelAnimationFrame(frame);
        window.clearTimeout(rest);
        el.removeEventListener("wheel", onRest);
        el.removeEventListener("wheel", wake, { capture: true });
        lenis.destroy();
        delete el.dataset.lenis;
      };
    });
    return () => {
      gone = true;
      off();
    };
  }, [live, paged]);

  /* Which cell is nearest the middle of the window. Read off the scroll
     position rather than with an observer, because the counter and the
     ruler want it every frame of a drag and not on a threshold. */
  const glide = React.useRef<(to: number) => void>(() => {});
  React.useEffect(() => {
    const el = scroller.current;
    if (!el || !live) return;
    let queued = 0;
    /* The cell in the middle, and its word. The word goes two places by
       hand rather than through state: onto the scroller as `data-at`, and
       into whatever `[data-strip-at]` the page put in its head, so the
       running head can say where you are without a render. */
    const land = (i: number, x: number) => {
      atRef.current = i;
      setAt(i);
      /* Julian: the screens either side loaded before they are asked for,
         so a page never arrives with its pictures still coming. A lazy
         image told to be eager starts loading at once. Paged strips only
         (home, About, Contact, Legal): their cells are whole screens. */
      if (paged) {
        for (const k of [i - 1, i + 1]) {
          el.children[k]
            ?.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')
            .forEach((img) => (img.loading = "eager"));
        }
      }
      /* The word is the nearest labelled cell at or before this one: the
         covers under a discipline carry no word of their own, and the head
         should go on saying the discipline while they go by. */
      /* At the very start there is nowhere to have got to, and the head
         already says what the page is. "Work" with "Editorial" under it,
         before anything has been clicked, reads as a filter that has been
         applied - Julian: all work has editorial under it before clicking
         the filter. It fills in as soon as the sequence moves. */
      let word = "";
      let section: HTMLElement | null = null;
      /* `x` from `read()`: reading `scrollLeft` again here, after the
         opacity writes, laid the page out to answer (Julian: the portfolio
         is laggy). */
      for (let k = x <= 2 ? -1 : i; k >= 0; k--) {
        const c = el.children[k] as HTMLElement;
        const w = c.dataset.label;
        if (w !== undefined) {
          word = w;
          section = c;
          break;
        }
      }
      /* And the address follows the same cell. Julian: a page with
         sections should say which one you are on, so the homepage reads
         `/#work` over Selected work and `/#cover-art` over the covers, and
         that address can be copied out of the bar and sent.

         `replaceState`, not a push: a page is one page however far along
         it you are, and pushing a section would turn the back button into
         a rewind through every section you passed. The router's own state
         is handed back with it, or Next loses its place. Only cells with a
         word are sections — a photograph on a project page has a hash so
         it can be linked to, and is not somewhere you have arrived. Never
         while the viewer is open: it keeps an entry of its own for the
         back button (`lib/zoom.ts`), and writing over it would leave the
         picture with no way out.

         Also only once the hand has stopped. Written straight from the
         scroll this ran once per section a swipe crossed, and Safari
         meters `replaceState` — a burst of them during a gesture is the
         one thing on this page that touches the history while a finger is
         moving it. Where you stopped is the address worth copying anyway.
         */
      const want = section?.dataset.hash ? `#${section.dataset.hash}` : "";
      if (want !== hashWanted) {
        hashWanted = want;
        clearTimeout(hashTimer);
        hashTimer = window.setTimeout(() => {
          if (
            want !== window.location.hash &&
            document.documentElement.dataset.viewer === undefined
          ) {
            window.history.replaceState(
              window.history.state,
              "",
              `${window.location.pathname}${window.location.search}${want}`,
            );
            // A replace fires nothing; the header's links listen for this.
            window.dispatchEvent(new Event(STRIP_SECTION));
          }
        }, 200);
      }
      if (word === el.dataset.at) return;
      el.dataset.at = word;
      const out = el.closest("article")?.querySelector("[data-strip-at]");
      if (out) out.textContent = word;
    };
    /* The columns of a cell that fade with it: the ones carrying no
       picture. A cell is often a photograph and a column of words side by
       side, and the photograph must not fade. Held per cell and rebuilt
       only when the cell's children change, because this is read on every
       frame of a swipe. */
    const soften = new WeakMap<
      HTMLElement,
      { n: number; list: HTMLElement[] }
    >();
    const fades = (cell: HTMLElement) => {
      const had = soften.get(cell);
      if (had && had.n === cell.childElementCount) return had.list;
      const pic = "img, video, picture, .strip-frame";
      /* `matches` as well as `querySelector`: a cell whose picture is its
         own direct child — no wrapper around it — passed the old test,
         because an `img` contains no `img`. The strip then faded the
         photograph itself and left it at `opacity: 0` when the swipe
         stopped. RELAY and UNDISPUTED were the two covers built that way. */
      const list = (Array.from(cell.children) as HTMLElement[]).filter(
        (c) => !c.matches(pic) && !c.querySelector(pic),
      );
      soften.set(cell, { n: cell.childElementCount, list });
      return list;
    };
    let hashTimer = 0;
    let hashWanted: string | null = null;
    /* Reduced motion keeps the words at full strength, which is what the
       stylesheet used to say. */
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ── the cells' geometry, read once ──
       Where each cell sits and how wide the scroller is. This used to be
       read inside `read()`, which runs a frame at a time for the length of
       every scroll: `offsetLeft`, `offsetWidth`, `scrollWidth` and
       `clientWidth` all make the browser lay the page out before they can
       answer, and the opacity written at the end of the same pass leaves it
       dirty again for the next frame. Measured on a rack in grid view, one
       second of scrolling: 196 layouts and 349 style recalculations, 149ms
       of style and 110ms of script. That is the jitter Julian could see
       when a filter changed — the change simply lands on top of it.

       None of it moves while the strip scrolls. A cell's place against its
       neighbours is fixed by the layout and only changes when the scroller
       does: a resize, a switch between the strip and the rack, a page with
       a different number of cells. So it is measured on those and read from
       here otherwise, and a scroll frame does no layout at all. */
    let centres: number[] = [];
    let span = 0;
    let reach = 0;
    let firstEnd = 0;
    // The cells the rail draws, by index: measured with the geometry.
    let ticked: number[] = [];
    // The cells whose words are faded now, so a frame leaves the rest alone.
    const faded = new Set<number>();
    const remeasure = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      ticked = kids.flatMap((k, i) => (k.dataset.tick !== undefined ? [i] : []));
      // Every cell looked at once after a change, so none keeps a stale fade.
      faded.clear();
      kids.forEach((_, i) => faded.add(i));
      span = el.clientWidth;
      reach = el.scrollWidth - span;
      centres = kids.map((c) => leftOf(c) + c.offsetWidth / 2);
      const first = kids[0];
      firstEnd = first ? leftOf(first) + first.offsetWidth * 0.5 : 0;
    };

    const read = () => {
      queued = 0;
      const x = el.scrollLeft;
      // Where to sit somebody down if they come back to this path.
      seatX.current = Math.round(x);
      const kidCount = el.children.length;
      if (centres.length !== kidCount) remeasure();
      const room = reach;
      /* Whether the opening cell has gone. A page's running head waits for
         this: the sequence opens on its title set large, and two titles on
         one screen is the same words twice. Half the cell's width, so the
         swap happens as it leaves rather than after it has. The rule that
         reads this is in `globals.css`. */
      el.toggleAttribute("data-past-first", kidCount > 0 && x > firstEnd);
      /* Either end is that end's cell, whatever is nearest the middle.
         At the far end the last cell is often narrower than half a window,
         so the middle of the window sits over the one before it and the
         counter could never reach the last cell at all. */
      const middle = x + span / 2;
      const kids = Array.from(el.children) as HTMLElement[];
      // Measured, not read: see `remeasure` above.
      const offs = centres.map((c) => c - middle);
      let best = 0;
      let nearest = Infinity;
      offs.forEach((off, i) => {
        if (Math.abs(off) < nearest) {
          nearest = Math.abs(off);
          best = i;
        }
        /* ── the words come and go with the cell ──
           Where each cell is against the middle of the window, as a
           fraction of the window: full strength near the middle, gone by
           the time the cell is a window away, which is the moment it
           leaves. Tied to the scroll position and nothing else, so it is
           as smooth as the scroll is and stops when it stops. Cells more
           than a window and a half away are left alone.

           Written straight onto the columns that fade rather than handed
           to the cell as `--par` for the stylesheet to read. A custom
           property inherits, so setting one on a cell invalidated the
           style of everything under it, every frame, for every cell on
           screen: measured on the homepage, 403ms of style recalculation
           inside a swipe of a second and a half, against 18ms with the
           writes taken out. That was the lag Julian could feel. */
        const par = off / span;
        const away = Math.min(1, Math.abs(par));
        /* A cell far off and already clear is skipped outright: the
           portfolio has two hundred, and every one was looked over on
           every frame. */
        if (Math.abs(par) > 1.5 && !faded.has(i)) return;
        const soft = fades(kids[i]);
        if (Math.abs(par) > 1.5) {
          faded.delete(i);
          for (const c of soft) if (c.style.opacity) c.style.opacity = "";
        } else if (!still) {
          faded.add(i);
          const o = Math.max(0, Math.min(1, (1 - away) / 0.45)).toFixed(2);
          for (const c of soft) if (c.style.opacity !== o) c.style.opacity = o;
        }
      });
      /* ── where the rail says you are ──
         The strip is one cell to a screen, so the cell in the middle of
         the window is the cell you are on and the rail reaches both ends
         on its own.

         The rack is not. Five columns are on screen at once, so the middle
         of the window sits two and a half columns short of the last one,
         and the lit segment stopped at the tenth of fifteen with the
         pictures already at the end — 67% of the rail, measured on
         production on Brand campaigns at 2000. Julian: the scroll bar does
         not reach the end. So in the rack the rail is driven by how far the
         shelf has travelled rather than by what is in the middle, which
         lands the first tick at nought and the last at the end by
         construction.

         And the end lands on the last cell that carries a tick, not on the
         last cell. They are not the same: a sequence can finish on a card
         that leads on or on a page of words, neither of which the rail
         draws, and `at` pointing at one of them lit nothing at all —
         measured, the rail went blank on the final frame of the travel. */
      const lastTick = ticked.length
        ? ticked[ticked.length - 1]
        : kids.length - 1;
      const firstTick = ticked.length ? ticked[0] : 0;
      /* A sequence short enough to fit the window has nowhere to go, and
         `scrollLeft` is nought forever. The end test ran first and `0 >=
         -2` is true, so the rail lit the last of four projects on a
         filter nobody had scrolled — measured on Artist presskit,
         Portraits and Mixed media, where the whole run is on screen at
         once. Nothing has moved, so the rail says the beginning. */
      if (room <= 0) land(firstTick, x);
      else if (x >= room - 2) land(lastTick, x);
      else if (x <= 2) land(firstTick, x);
      else {
        /* ── the eye slides across the window as the shelf travels ──
           At the start it reads the left edge, at the middle of the travel
           the middle of the window, at the end the right edge. One line,
           and it is what makes the rail both honest and able to reach the
           last column: the middle of the window alone never gets there,
           because five columns are on screen and the last one is still two
           and a half short when the shelf stops.

           This replaces a reading that took how far the shelf had gone and
           named the tick that far along the *list*. That is only true if
           every column is the same width, and in the rack they are not: a
           landscape column is twice an upright one, and All work runs 72
           projects over eleven chapters of very different lengths. Julian,
           on Event coverage: it is showing Brand campaigns. It was — the
           rail was counting projects where it should have been measuring
           the shelf.

           And it lands on the nearest cell the rail can actually draw.
           `best` is the nearest cell of any kind, and a sequence carries
           cells with no tick — a page of words, the ask, the card that
           leads on — which lit nothing at all. */
        const gone = Math.max(0, Math.min(1, x / room));
        /* A paged strip is a screen to a section, so the one in the middle
           of the window is the one you are on. The sliding eye read a third
           of the way in early on the homepage and lit Biography with
           Sessions filling the screen (Julian, 2026-10-04). */
        const eye = paged ? x + span / 2 : x + gone * span;
        let near = best;
        let gap = Infinity;
        for (const i of ticked) {
          const d = Math.abs(centres[i] - eye);
          if (d < gap) {
            gap = d;
            near = i;
          }
        }
        land(near, x);
      }
    };
    /* The ruler's ticks, read off the cells once they are in the DOM: a
       cell is often a component of its own, so its attributes are not on
       the element the strip is handed. Set only when they change. */
    const readTicks = () => {
      const t = (Array.from(el.children) as HTMLElement[]).flatMap((c, i) =>
        c.dataset.tick !== undefined
          ? [{ i, word: c.dataset.label, name: c.dataset.name }]
          : [],
      );
      const key = t
        .map((x) => `${x.i}:${x.word ?? ""}:${x.name ?? ""}`)
        .join("|");
      if (key === tickKey.current) return;
      tickKey.current = key;
      setTicks(t);
    };
    let rest = 0;
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(read);
      setStill(false);
      window.clearTimeout(rest);
      rest = window.setTimeout(() => {
        setStill(true);
        // Arrived: the live reading is the true one again.
        setAim(null);
      }, REST);
    };
    // A hash changed underfoot (a chip on /work is a plain anchor): glide.
    const onHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const i = cellFor(el, hash);
      const where = i >= 0 ? centreOf(el, i) : null;
      if (where !== null) glide.current(where);
    };
    /* A link to a cell on this page, the nav's /#about on the homepage:
       Next's Link moves the address without a hashchange, so the strip
       takes the click. `pushState` keeps the router's search params. */
    const onLink = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.<HTMLAnchorElement>("a[href]");
      if (!a || a.target) return;
      const url = new URL(a.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname) return;
      if (cellFor(el, decodeURIComponent(url.hash.slice(1))) < 0) return;
      e.preventDefault();
      history.pushState(null, "", url.href);
      onHash();
    };
    document.addEventListener("click", onLink, true);
    // A frame later rather than now, so the first render is not followed
    // by a second one in the same tick.
    queued = requestAnimationFrame(() => {
      readTicks();
      remeasure();
      read();
    });
    /* The scroller changing shape is the one thing that moves the cells:
       a window resized, the rack swapped for the strip, a cell arriving.
       Measure again then, and never on a scroll frame. */
    /* A link straight to a cell, in the rack (Julian, 2026-10-04: every
       film on the homepage opened Event coverage). The landing is aimed
       before the rack has placed its frames, at where the cell stands in
       a strip, and the rack then moves it the better part of a screen
       further on. Until the visitor moves the row themselves, each
       re-lay aims again at the cell the address named on arrival. */
    let aimed = decodeURIComponent(window.location.hash.slice(1));
    const handed = () => {
      aimed = "";
    };
    for (const t of ["wheel", "pointerdown", "keydown", "touchstart"])
      el.addEventListener(t, handed, { once: true, passive: true });
    const again = () => {
      if (aimed) {
        const i = cellFor(el, aimed);
        const where = i >= 0 ? centreOf(el, i) : null;
        if (where !== null) el.scrollLeft = where;
      }
      remeasure();
      read();
    };
    const watch = new ResizeObserver(again);
    watch.observe(el);
    /* And when the rack has placed its frames. Moved, not resized, they
       change the shelf's length without the scroller changing size, so
       the end measured in the strip stood in the rack and the rail never
       reached its end there (Julian: at the end of the screen the scroll
       bar is not). */
    el.addEventListener(RELAID, again);
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", again);
    window.addEventListener("hashchange", onHash);
    return () => {
      watch.disconnect();
      el.removeEventListener(RELAID, again);
      for (const t of ["wheel", "pointerdown", "keydown", "touchstart"]) el.removeEventListener(t, handed);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", again);
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onLink, true);
      if (queued) cancelAnimationFrame(queued);
      window.clearTimeout(rest);
      clearTimeout(hashTimer);
    };
  }, [live, count, paged]);

  /* ── how it moves ───────────────────────────────────────────────
     Every way of moving the strip writes to one target and a single rAF
     loop eases the scroller towards it. A wheel notch is ~100px of jump
     if it is applied straight to `scrollLeft`; eased instead, the same
     notch is a glide, and notches that arrive together blend into one
     movement rather than stacking into a jolt. Julian asked for the
     horizontal scroll to be super smooth and to allow drag to scroll.

     A drag is the exception: while a pointer is down the strip tracks it
     exactly, because anything eased there feels like the picture is
     lagging behind the hand. The easing comes back on release, as
     momentum — the strip carries on at the speed it was let go.

     Reduced motion gets the same controls with the interpolation off. */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el || !live) return;
    const eased = !window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    /* Whether Lenis is carrying the travel on this strip. It never takes a
       paged one, and even where it does the two ends are still the
       strip's: the band and the lead-on to the next project are counted
       here, off wheel events Lenis would otherwise swallow. */
    const smooth = wantsLenis() && (!paged || matchMedia(WHEELED).matches);

    /* ── the scroller's own measurements, taken when it changes ──
       `scrollWidth` and `clientWidth` both make the browser lay the page
       out before they can answer, and the loop below writes `scrollLeft`
       every frame, which leaves the layout dirty for the next read. So
       reading them inside the loop cost a layout a frame: measured on a
       rack in grid view, 163 layouts and 342 style recalculations in one
       second of scrolling, and that is what the jitter is made of.

       Neither changes while the strip is moving. They are taken when the
       scroller changes shape, and again at the start of a gesture, which
       is the moment a cell could have arrived without the scroller itself
       resizing. Never on a frame.

       Nor while the page is arriving: read as the strip is set up, just
       after the deck has pinned its cells, they laid the page out again
       inside the trip in (measured on the way into the work). A frame on,
       the layout is the one the browser made anyway, and a gesture
       measures again at its start. */
    let width = 0;
    let span = 0;
    const size = () => {
      width = el.clientWidth;
      span = el.scrollWidth - width;
      // Read with the rest, once a push, not on every notch of it: asked
      // for after the pull's writes, it laid the homepage out again each
      // notch (scroll-craft pass, 2026-10-02: 25ms a notch at full speed).
      drawn = !!(win ??= el.querySelector<HTMLElement>(":scope > [data-lead-window]"))?.getClientRects().length;
    };
    const room = () => span;
    const clamp = (v: number) => Math.min(room(), Math.max(0, v));
    let target = 0;
    let frame = 0;
    // Where the strip is and how fast it is going, in px and px per ms.
    let x = 0;
    const firstSize = requestAnimationFrame(() => {
      size();
      x = target = el.scrollLeft;
    });
    let v = 0;
    let last = 0;
    /* ── the band ──
       Push past either end and the strip does not stop dead, it gives a
       little and comes back — the resistance Julian asked for at the ends.
       `over` is the raw pull past the end, positive at the right and
       negative at the left; the band shown is that pull through
       `rubberband`, so the first pixels move it and the later ones barely
       do. It drains under RELAX whenever the pushing stops. And at the
       right-hand end it is also the count: keep pushing past LEAVE_AFTER of
       it and the sequence leads on to the next page. So the stretch is
       the receipt for the count — you can see how far along you are. */
    let over = 0;
    /** While a paged move is landing, another gesture is the same gesture. */
    let locked = 0;
    let pushed = 0;
    let band = 0;
    let leaving = false;

    /* Drawn with the `translate` property and not `transform`. This is the
       one trap in here: `strip-scroll` in `globals.css` animates
       `transform` for both the arrival and the `[data-leaving]` exit, and an
       inline transform would outrank the exit — the strip would snap back
       to zero and leave from there. The two properties compose instead, so
       the exit slide simply starts from wherever the band had got to. */
    /* The window into the work, on the homepage: the pull opens it out
       of the right edge, up to a third of the screen at the count. Looked
       up when first asked for, since with `defer` it mounts after the strip
       does. */
    let win: HTMLElement | null = null;
    let drawn = false;
    /* Through the window it is one scroll past it, either way (Julian:
       seamless): the word already said what is next, so there is nothing
       to make sure of. Everywhere else the band asks for a persistent
       push (`lead-window.tsx`). */
    const door = (dir: 1 | -1) =>
      // A cell of no width, but drawn: none under a finger on a phone.
      (dir > 0
        ? win
          ? drawn
          : // Not in yet (`defer`): looked for until it is.
            (drawn = !!(win = el.querySelector<HTMLElement>(":scope > [data-lead-window]"))?.getClientRects().length)
        : prevStart && prevHref === "/");
    /* The portfolio stacking over the home (`data-stack`, the default):
       past the last screen the wheel carries the portfolio's card in as
       it carries a screen, the strip's gain a notch, all the way across
       (Julian: on scroll as well from the last page of home). */
    const stacked = (dir: 1 | -1) =>
      dir > 0 && door(1) && "stack" in document.documentElement.dataset;
    const after = (dir: 1 | -1) =>
      stacked(dir) ? innerWidth / WHEEL : door(dir) ? 90 : LEAVE_AFTER;
    const paint = () => {
      if (leaving) return;
      // Three notches read 48, 94 and 136px, so the band is still growing
      // at the moment it goes. It was half that and Julian said it did not
      // feel like a rubber band: give that cannot be seen is a stop.
      const pull = eased && over ? rubberband(over, width, 0.5) : 0;
      /* Into the window, the last screen is the card on top and slides
         off the portfolio under it by as much as it shows (`lead-pane`),
         up to three tenths of the screen. Only that screen: the strip
         moved whole took the pane out of its own clip. A cubic, so it
         gives easily and then stiffens towards the count, and the
         crossing is a detent given way (Julian: a tiny bit of
         resistance). */
      if (over > 0 && door(1) && win) {
        const shown = Math.round(
          stacked(1)
            ? Math.min(innerWidth, over * WHEEL)
            : innerWidth * 0.3 * (1 - (1 - Math.min(1, over / after(1))) ** 3),
        );
        const last = win.previousElementSibling as HTMLElement;
        /* `data-stack` (the default; `?stack=0` opts out): the portfolio comes in over the last screen, which
           sinks back as the deck's screens do, instead of sliding off. */
        if ("stack" in document.documentElement.dataset) {
          last.style.scale = String(1 - (0.1 * shown) / innerWidth);
          /* The homepage's rail gives way as the card comes over it. Set on
             the rail, the one thing that reads it: on the band it was
             inherited by the whole homepage, which restyled every notch. */
          el.closest<HTMLElement>(".strip-band")?.querySelector<HTMLElement>(".strip-rail")?.style.setProperty("--lead-in", (shown / innerWidth).toFixed(3));
        } else last.style.translate = `${-shown}px`;
        win.style.setProperty("--lead-pull", `${shown}px`);
        return;
      }
      const shift = pull ? -Math.max(-STRETCH, Math.min(STRETCH, pull)) : 0;
      el.style.translate = shift ? `${shift}px` : "";
    };

    /* Momentum and friction, measured off the reference. Julian recorded
       remyshoots.co.za; read frame by frame, its strip's speed climbs while
       the wheel turns and then decays once it stops, running out over about
       two thirds of a second. That is velocity with friction: nothing
       chases a target, the strip simply has a speed. A spin is one
       continuous motion because the speed accumulates; a lone notch is a
       glide that tails off. Two earlier tries each felt wrong in their own
       way — a lerp trailed the hand by six frames, and an ease that
       restarted on every notch pulsed at the notch cadence.

       TAU is the friction: the time in which the speed falls to a third,
       and so also how far a speed carries (speed × TAU). It was swept
       against a steady spin rather than picked, because it trades two
       things off. The reference's own tail decays by a fifth per frame,
       which is a TAU near 90 — but a notched wheel fires about ten times a
       second, and at 90 the speed sagged between notches: the strip moved
       between 8px and 27px a frame at exactly the notch cadence. That
       ripple, once per picture, is the snap Julian saw. More friction
       holds the speed through the gaps. Measured on the dev server:

         TAU     90   120   150   180   220
         swing  ±5.4  ±4.0  ±3.3  ±2.8  ±2.5   px per frame
         lag       0     1     4     8    19   px behind after a spin

       180 is where the ripple has flattened and the strip is still within
       8px of the hand. Integrated exactly per frame, so a tick lands where
       it aimed and 60Hz and 144Hz feel the same. `target` is always where
       the strip will stop. */
    /* Julian: smoother. 180 carried a tail a reader could watch — the
       landing test is the remaining distance, so at seven time constants
       the strip was still creeping a third of a pixel a frame more than a
       second after the hand stopped, and a sequence that is still moving
       when you have finished the gesture reads as lag rather than glide.
       150 catches up sooner and the landing below is called earlier. */
    const TAU = 150;
    /* How long a paged move owns the wheel. A mouse notch is one turn of
       the hand and another turn a moment later means another screen, so
       its lock is short. A trackpad sends a stream of small deltas for one
       swipe and keeps sending them through the momentum afterwards, so
       every one of those extends the lock: one swipe is one screen, however
       long the fingers keep gliding. */
    const NOTCH_LOCK = 260;
    const SWIPE_LOCK = 380;

    const step = (now: number) => {
      const dt = Math.min(32, last ? now - last : 16);
      last = now;
      const decay = Math.exp(-dt / TAU);
      x += v * TAU * (1 - decay);
      v *= decay;
      const end = room();
      if (x <= 0 || x >= end) {
        x = Math.min(end, Math.max(0, x));
        v = 0;
      }
      /* Landed. A pixel and a half rather than half a pixel: `scrollLeft`
         is whole pixels, so everything under one is a frame of work
         nobody can see — measured on /work, sixty frames of it at the end
         of every swipe. */
      if (Math.abs(target - x) < 1.5 && Math.abs(v) * TAU < 1.5) {
        x = target;
        v = 0;
        el.scrollLeft = x;
        frame = 0;
        last = 0;
        return;
      }
      el.scrollLeft = x;
      frame = requestAnimationFrame(step);
    };

    /** The band's own loop, apart from the strip's: it holds while the
        pushing goes on and drains once it stops. Its own loop because the
        strip's writes `scrollLeft` every frame, and a strip loop kept up for
        the band would overwrite a keyboard or touch scroll for as long as
        the band took to settle — seen in the test, where a jump to the end
        was put straight back to the start. */
    /* ── the wall ──
       An end with nowhere to lead on is a wall, and a push into it is one
       bounce: the strip gives a little and springs back past rest, the
       way a thrown thing meets a spring, and that is the whole answer
       that nothing is there. It was the band, and a trackpad keeps
       sending its swipe for a second as the fling runs out, so the band
       climbed a step a notch to its 160px stop and sat there until the
       fingers' momentum ended (Julian: scrolling left on the homepage is
       stuttery). The bounce is the browser's own animation, run off the
       main thread, and a swipe gets one however long it keeps sending.

       The curve is a damped spring's response to a knock (damping 0.5,
       out at 120ms, back past rest by a sixth, still by 800ms), sampled. */
    const WALL = [0, 0.403, 0.694, 0.881, 0.979, 1.0, 0.961, 0.878, 0.764, 0.633, 0.496, 0.362, 0.238, 0.128, 0.035, -0.039, -0.094, -0.132, -0.154, -0.163, -0.161, -0.15, -0.133, -0.113, -0.091, -0.069, -0.048, -0.028, -0.012, 0.001, 0.012, 0.019, 0];
    const WALL_MS = 800;
    let wall: Animation | null = null;
    const bounce = (dir: 1 | -1, speed: number) => {
      if (!eased || wall || room() < 1) return;
      const reach = -dir * Math.min(72, 24 + speed * 0.5);
      const a = el.animate(
        WALL.map((k) => ({ translate: `${(k * reach).toFixed(1)}px` })),
        { duration: WALL_MS },
      );
      wall = a;
      const done = () => {
        if (wall === a) wall = null;
      };
      a.finished.then(done, done);
    };

    /** Lets the band go: CSS springs it back (`[data-release]` in
        `globals.css`), so nothing here paints the return frame by frame. */
    const release = () => {
      if (leaving || "release" in el.dataset) return;
      el.dataset.release = "";
      el.style.translate = "";
      if (win) {
        const last = win.previousElementSibling as HTMLElement;
        last.style.translate = "";
        last.style.scale = "";
        el.closest<HTMLElement>(".strip-band")?.querySelector<HTMLElement>(".strip-rail")?.style.removeProperty("--lead-in");
        win.style.setProperty("--lead-pull", "0px");
      }
    };
    const relax = (now: number) => {
      if (now - pushed > HOLD) {
        /* Let go a fifth of the way in or more, and the card carries on
           over, as a screen does (`settle`); less, and it goes back. */
        if (over > 0 && stacked(1) && over * WHEEL > innerWidth * 0.2) {
          leave(1);
          if (leaving) {
            band = 0;
            return;
          }
        }
        release();
        // The count drains on its own clock, unseen.
        over *= Math.exp(-16 / RELAX);
        if (Math.abs(over) < 1) over = 0;
      }
      band = over ? requestAnimationFrame(relax) : 0;
    };
    const push = (by: number) => {
      /* A strip with one screen in it and nowhere to lead on has nothing
         to stretch against: the band was give with nothing behind it,
         which reads as the page wobbling. Julian asked for it gone. */
      if (room() < 1 && !(by > 0 ? nextHref : prevHref)) return;
      over += by;
      pushed = performance.now();
      delete el.dataset.release;
      paint();
      if (!band) band = requestAnimationFrame(relax);
    };

    /* ── a paged move is a slide, not a throw ──
       Julian: the scroll smooth, the homepage above all. A paged move went
       through the momentum above, which aims a speed that runs out at the
       next screen: measured on the homepage at 1440, 281px of the 1440 in
       the first frame and then a tail, the last 100px taking 600ms. A lurch
       and a crawl. A screen to screen move is a slide, so it is timed and
       eased in and out like the opening's lift. A move that starts while
       another is running is already travelling, so it carries on with the
       ease out only, timed so it sets off at the speed it already had: a
       quick second notch runs on into the next screen without a stall or a
       kick. Julian, after 800ms shipped: slow. 550. */
    const PAGE_MS = 550;
    const inOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const out = (t: number) => 1 - (1 - t) ** 2;
    let from = 0;
    let began = 0;
    let curve = inOut;
    let length = PAGE_MS;
    // The slide's speed on its last frame, px per ms, for a handover.
    let pace = 0;
    let paced = 0;
    const slide = (now: number) => {
      if (!began) began = now;
      const t = Math.min(1, (now - began) / length);
      const was = x;
      x = from + (target - from) * curve(t);
      if (paced) pace = (x - was) / Math.max(1, now - paced);
      paced = now;
      el.scrollLeft = x;
      if (t < 1) {
        frame = requestAnimationFrame(slide);
        return;
      }
      frame = 0;
      last = 0;
      v = 0;
      pace = 0;
      paced = 0;
    };

    /** Aims the strip: sets the speed that runs out exactly at `where`. */
    const to = (where: number) => {
      target = clamp(where);
      if (!eased) {
        el.scrollLeft = target;
        return;
      }
      /* Where the browser is snapping, it scrolls and this does not.

         A paged strip under a finger has `scroll-snap-type: x mandatory`
         (`strip-paged` in `globals.css`), which is what lands each swipe on
         a section. Snap and a scripted scroll are the same argument twice:
         the loop below writes `scrollLeft` a frame at a time and the snap
         engine pulls each of those writes to the nearest section, so a
         press on the ruler arrived instantly — measured on an iPad, nought
         to 768 between one frame and the next, where a swipe to the same
         place takes half a second of moving picture. Julian asked for the
         press to look like the swipe.

         So hand it over. `behavior: "smooth"` is the browser's own travel,
         which is what the finger gets, and it lands on the snap point
         rather than fighting it. Read off the element rather than from a
         media query, so this follows the rule wherever it applies. */
      if (getComputedStyle(el).scrollSnapType !== "none") {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        last = 0;
        v = 0;
        x = target;
        el.scrollTo({ left: target, behavior: "smooth" });
        return;
      }
      if (paged) {
        from = el.scrollLeft;
        const still =
          !frame || !pace || Math.sign(pace) !== Math.sign(target - from);
        curve = still ? inOut : out;
        /* The ease out sets off at twice the average speed, so a length of
           twice the distance over the speed it had matches the two. */
        length = still
          ? PAGE_MS
          : Math.min(
              PAGE_MS * 1.5,
              Math.max(
                PAGE_MS / 2,
                (2 * Math.abs(target - from)) / Math.abs(pace),
              ),
            );
        if (frame) cancelAnimationFrame(frame);
        // From now, so the first frame already moves.
        began = performance.now();
        paced = 0;
        x = from;
        frame = requestAnimationFrame(slide);
        return;
      }
      // Pick up from wherever the keyboard, a touch or a drag left it.
      if (!frame) {
        x = el.scrollLeft;
        last = 0;
      }
      v = (target - x) / TAU;
      if (!frame) frame = requestAnimationFrame(step);
    };
    glide.current = to;

    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      v = 0;
      x = target = el.scrollLeft;
    };

    /* ── the way on ──
       Push past the right-hand end and the band shows it; keep pushing and
       the sequence leads on: the strip slides off to the left and the next
       page's strip arrives from the right (`strip-scroll` in
       `globals.css`). Stop pushing and the band relaxes and the count with
       it, so a wheel that merely arrives at the end and overshoots goes
       nowhere, and only one that persists does. Julian asked for exactly
       that: a little resistance, and if the scrolling persists, the next
       project.

       Arriving does not count as asking to leave again. The strip a visitor
       has just been carried to mounts with the wheel still turning, and
       without this one hard spin skipped a project and then the one after
       it. Half a second of quiet makes each step a decision. */
    let arrived = performance.now();
    let paused = false;
    /* Two filters of the work index are one page with the row swapped, not
       two pages. */

    const leave = (dir: 1 | -1) => {
      const href = dir > 0 ? nextHref : prevHref;
      /* Not for the portfolio's card: it takes a full window of pushing
         past the last screen, which no spin that led here can be. Kept, it
         left the card over the whole window until the next notch. */
      if (!href || leaving || (!stacked(dir) && performance.now() - arrived < 500)) return;
      /* The end of a strip whose later screens have not come in yet is not
         its end: on the homepage's hero alone, a push was the way out. */
      if (dir > 0 && heldBack.current) return;
      /* Never off a page with words typed into its form: the contact form
         keeps no state, and a drag across its intro or a spin over its
         steps took a half written inquiry to About and back empty. The
         band still gives; the bar still goes. */
      if (
        [...el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          "input:not([hidden], [type=hidden], [type=radio], [type=checkbox]), textarea",
        )].some((f) => f.value.trim())
      )
        return;
      leaving = true;
      // The band holds where it is and the slide starts from it.
      if (band) cancelAnimationFrame(band);
      band = 0;
      /* Dealt at the ends (`deck="leads"`, `lib/deck.ts`): the next page's
         strip comes in as a card over this one while this one recedes,
         and backwards this one goes off the way it came and the one
         before comes up from behind. The trip is the page transition's
         (`deal` in `globals.css`); this strip names itself so it is
         snapshotted apart from the page, and the root says which way. */
      if (deck === "leads") {
        dealtAt = Date.now();
        cameBack = dir < 0 && !prevStart;
        arriveDir = dir;
        el.style.setProperty("view-transition-name", "strip");
        const root = document.documentElement;
        root.dataset.nav = "deal";
        root.dataset.navWay = dir > 0 ? "on" : "back";
        /* The strip that arrives takes this off when its trip lands. This
           is only for a push that never lands. */
        window.setTimeout(() => {
          if (root.dataset.nav !== "deal") return;
          delete root.dataset.nav;
          delete root.dataset.navWay;
        }, DEAL_MS);
        router.push(href);
        return;
      }
      /* Places to Motion was a page leaving and a page arriving: the strip
         slid off, and for the 260ms it took the screen was bare paper —
         measured on production, mean brightness at 235.8 with nothing on
         it from 457ms to 718ms. Between two filters the head and the chip
         row do not change, so there is nothing to leave: the row is
         swapped where it stands, the way a chip press does it, and the
         push goes out at once. */
      const index = filterPaths();
      if (index.has(window.location.pathname) && index.has(href)) {
        markFilter(dir);
        cameBack = dir < 0 && !prevStart;
        arriveDir = dir;
        router.push(href);
        return;
      }
      /* Julian: keep the stack when scrolling past a page into the next
         one. Any other page is dealt whole, as the bar deals it (`nav-side`
         in `globals.css`): the next page in as a card from the right over
         this one, which recedes, and back the one before from the left.
         Only the strip, as on the work's pages, left the next page's head
         popping in over this one (home into the work index, Julian: very
         glitchy). The arrival clears it (`page-transition.tsx`). */
      cameBack = dir < 0 && !prevStart;
      arriveDir = dir;
      const root = document.documentElement;
      root.dataset.nav = "in";
      /* The window into the work, opened the rest of the way from where
         the pull left it, and back from the work the door shutting into
         the homepage's right edge (`lead-window.tsx`). */
      if (door(dir)) {
        if (dir > 0 && win) openFrom(win);
        root.dataset.navSide = dir > 0 ? "open" : "shut";
        window.setTimeout(() => {
          if (root.dataset.navSide === undefined) return;
          delete root.dataset.nav;
          delete root.dataset.navSide;
        }, DEAL_MS);
        router.push(href);
        return;
      }
      /* Julian: back is the stack scrolled backwards, so this page, the
         card on top, goes off to the right and the one before comes up
         from behind (`back` in `globals.css`), not in over it from the
         left as the bar deals it. */
      root.dataset.navSide = dir > 0 ? "right" : "back";
      window.setTimeout(() => {
        if (root.dataset.navSide === undefined) return;
        delete root.dataset.nav;
        delete root.dataset.navSide;
      }, DEAL_MS);
      router.push(href);
    };

    /* ── a finger past the end ──
       The wheel stretches the band and leads on at `LEAVE_AFTER`; a finger
       never reached that path, because a touchscreen scrolls the strip
       itself and the browser stops it dead on the last cell. Julian, on
       an iPad held sideways: on a filter, allow swiping back and forth to
       the previous and next filter. So a swipe that finds the strip
       already at its end, and carries on the same way, is read as that
       ask. The band is pushed with the finger so the pull is seen, and at
       `LEAVE_TOUCH` of it the strip leads on through the same `leave` the
       wheel uses — between two filters that is the row swapped in place.

       Native scrolling is left alone: the listeners are passive, a swipe
       with room still to scroll is not read at all, and the edge is
       decided once at the start of the gesture, so a swipe that arrives
       at the end mid-travel does not carry straight through into the next
       page. Two fingers are the platform's, and are ignored. */
    let touchX: number | null = null;
    let touchEdge: 1 | -1 | 0 = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        touchX = null;
        return;
      }
      touchX = e.touches[0].clientX;
      const r = room();
      // A run that fits the window is at both ends at once: 0 here, and
      // the move reads the direction instead.
      touchEdge =
        r < 1 ? 0 : el.scrollLeft >= r - 2 ? 1 : el.scrollLeft <= 2 ? -1 : 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchX === null || e.touches.length !== 1 || leaving) return;
      const x = e.touches[0].clientX;
      const by = touchX - x;
      touchX = x;
      // Which way the finger is going, as the band counts it: forward is
      // positive, the same sign the wheel gives `push`.
      const dir: 1 | -1 = by > 0 ? 1 : -1;
      const r = room();
      const edge = r < 1 ? dir : touchEdge;
      if (edge !== dir || !(dir > 0 ? nextHref : prevHref)) return;
      push(by);
      if (over >= LEAVE_TOUCH) leave(1);
      if (over <= -LEAVE_TOUCH) leave(-1);
    };
    const onTouchEnd = () => {
      touchX = null;
      touchEdge = 0;
    };

    /* A wheel moves the strip sideways, whichever way it is turned.
       `passive: false` because it has to be able to take the event; left
       passive, the browser would scroll the page at the same time and both
       would move.

       Both axes through here, and that is the fix for what Julian saw as
       a glitchy trackpad. A sideways swipe used to be handed to the
       browser to scroll the overflow natively, so the strip had two ways
       of moving at once: the browser writing `scrollLeft` with its own
       momentum, and the loop below easing towards a target it had worked
       out before any of that happened. A diagonal swipe — which every
       trackpad swipe is, a little — ran both, and the next notch yanked
       the strip back to a target measured from where it used to be. One
       path, one idea of where the strip is going, and up, down, left and
       right all reach it. */
    /* One swipe is one gesture, and who owns it is decided once.
       A trackpad sends a stream of events for a single push of two
       fingers, and each one is aimed at whatever happens to be under a
       cursor that never moved: as the strip carries cells along, that is
       a different element every few frames. Deciding per event let the
       middle of a swipe land on something that wanted the wheel for
       itself — an inner box, a tile, a list — and the rest of the push
       did nothing. Whoever the first event of a gesture goes to keeps it
       until the fingers lift, which is a gap of `GESTURE_GAP_MS`. */
    let gestureAt = 0;
    let owned = false;
    /* A fling decays and a hand does not. `peak` is the biggest delta of
       the push that is running and `prevMag` the one before this one, so a
       delta that climbs again once the tail has fallen away is the next
       swipe arriving before the last one has died. The lock below is
       pushed another SWIPE_LOCK into the future by every momentum event,
       and a trackpad's momentum runs for a second or two, so without this
       a swipe made while the last one was still gliding was thrown away
       whole. Measured on the homepage before the fix: three swipes, each a
       full second after the fingers lifted, moved one section between
       them. That is the hit-and-miss Julian reported on the Mac. */
    let peak = 0;
    let trough = Infinity;
    let again = false;

    const onWheel = (e: WheelEvent) => {
      // A pinch is a zoom.
      if (e.ctrlKey) return;
      const now = e.timeStamp || performance.now();
      // Since the last notch here, or since the page came if none has yet.
      const before = gestureAt;
      const gap = now - Math.max(before, arrived);
      const fresh = now - before > GESTURE_GAP_MS;
      gestureAt = now;
      // A new push: take the measurements again, once, before using them.
      if (fresh) size();
      const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const raw = sideways ? e.deltaX : e.deltaY;
      if (!raw) return;
      /* Half a second of quiet, not half a second since the mount: the
         spin that led here is still that spin until it pauses, so the
         arrival moves with it. A long spin went Sessions to Contact to
         About with Contact on screen for under a second. A pause is
         300ms, and a second for the first notch here: the page mounting
         under the spin stalls it. Only for a page a spin or a drag led
         to; one reached from the bar owes nothing to a wheel. */
      if (!paused) {
        if (!arriveDir || gap > (before > arrived ? 300 : 1000)) paused = true;
        else arrived = performance.now();
      }
      /* The tail of the push that brought the page here. A trackpad keeps
         sending momentum after the strip has led on, and those notches
         land on the strip that has just arrived: measured on Contact
         pushed back to About, the page landed at its end as it should and
         then paged itself straight back to the start, on a notch that came
         560ms after the mount. So for the first second, a push the same
         way as the one that led here is that push still running out, and
         is dropped; the other way is a new decision and goes through. Not
         under Lenis, which has the wheel there. */
      if (
        !smooth &&
        arriveDir !== 0 &&
        Math.sign(raw) === arriveDir &&
        performance.now() - arrived < 1000
      ) {
        e.preventDefault();
        return;
      }
      /* Something inside a cell that scrolls on its own gets the wheel
         first: a form's box until it has run out, a textarea and a select
         always. A strip that took the wheel over a form would move the
         page out from under the words being typed. */
      const inner =
        sideways || (!fresh && owned)
          ? null
          : (e.target as Element | null)?.closest?.<HTMLElement>(
              "textarea, select, [data-scroll]",
            );
      if (inner && el.contains(inner)) {
        owned = false;
        // A textarea or a select keeps the wheel whatever it holds. A
        // marked box gives it back once it has run out, whatever element
        // it happens to be: the contact page's details are a `dl` and the
        // studio's services a `ul`, and a tag-name test left both of them
        // holding the wheel for good.
        if (!inner.hasAttribute("data-scroll")) return;
        const more =
          e.deltaY < 0
            ? inner.scrollTop > 0
            : inner.scrollTop + inner.clientHeight < inner.scrollHeight - 1;
        if (more) return;
      }
      owned = true;
      // Firefox can report lines rather than pixels.
      const dy = e.deltaMode === 1 ? raw * 40 : raw;
      /* Measured against the quietest the stream has been since its peak,
         not against the event before it. A new push and the tail it lands
         on arrive interleaved — macOS keeps the old fling coming for a
         moment after the fingers are down again — so the event before
         this one may belong to either, and a rule that reads it compares
         a push against a fling. The trough belongs to the fling alone,
         because a fling only ever gets quieter. Twice it, and at least
         six, is a hand: momentum comes in whole pixels and jitters by
         one, and a push that is still climbing never sees a trough at all
         because the trough is only taken once the stream is under half
         its peak. */
      const mag = Math.abs(dy);
      if (fresh) {
        peak = 0;
        trough = Infinity;
      }
      again = mag >= 6 && mag > trough * 2 && trough < peak / 2;
      if (again) {
        peak = mag;
        trough = Infinity;
      } else {
        peak = Math.max(peak, mag);
        if (mag < peak / 2) trough = Math.min(trough, mag);
      }

      /* By where the strip is, not where it is heading: a notch that lands
         while the strip is still gliding up to the end aims it there and
         no further, and only once it has got there does the next one pull
         the band. That tail of the glide is the beat between arriving and
         asking to leave, and it comes free with the friction. */
      if (dy > 0 ? el.scrollLeft >= room() - 1 : el.scrollLeft <= 0) {
        /* A page that can still scroll vertically goes first, in both
           directions: a project strip on a phone has its footer below it.
           From 40rem up a strip page cannot scroll at all (`globals.css`),
           so neither of these is ever true there. */
        if (!sideways && dy < 0 && window.scrollY > 0) {
          owned = false;
          return;
        }
        if (
          !sideways &&
          dy > 0 &&
          document.documentElement.scrollHeight -
            window.innerHeight -
            window.scrollY >
            1
        ) {
          owned = false;
          return;
        }
        owned = true;
        e.preventDefault();
        // Nowhere to go that way: the wall. A swipe knocks once; a
        // mouse's notch is a knock of its own.
        if (!(dy > 0 ? nextHref : prevHref)) {
          if (fresh || again || Math.abs(dy) >= 80) bounce(dy > 0 ? 1 : -1, Math.abs(dy));
          return;
        }
        push(dy);
        // Past the end, on; past the start, back. Julian asked for both.
        if (over >= after(1)) leave(1);
        if (over <= -after(-1)) leave(-1);
        return;
      }
      // A notch the other way lets go of the band, and of the count.
      if (over) {
        over = 0;
        release();
      }
      /* Away from the ends, Lenis has the wheel. Nothing is prevented and
         nothing is aimed: its own listener moves the scroller, and this
         handler has already done the only part it keeps. */
      if (smooth) return;
      e.preventDefault();
      /* Paged: the gesture means the next screen, whatever its size. A
         trackpad sends a stream of small deltas for one swipe and a mouse
         one large notch for one turn, so the move is locked for as long as
         it takes to land — otherwise a single swipe would fly through four
         sections. */
      if (paged) {
        const now = performance.now();
        const notch = Math.abs(dy) >= 80;
        if (now < locked && !again) {
          if (!notch) locked = now + SWIPE_LOCK;
          return;
        }
        locked = now + (notch ? NOTCH_LOCK : SWIPE_LOCK);
        const last = el.children.length - 1;
        const where = centreOf(
          el,
          Math.max(0, Math.min(last, nearest(target) + (dy > 0 ? 1 : -1))),
        );
        if (where !== null) to(where);
        return;
      }
      to(target + dy * (Math.abs(dy) >= 80 ? WHEEL : PAD));
    };

    /* Drag, for a mouse only. A touchscreen is left to the platform: its
       own flick and momentum, and on a paged strip the browser's scroll
       snap (`strip-paged` in `globals.css`) lands each swipe on a section.
       The first version took the finger over on paged pages and moved it
       one section per swipe by hand; on an iPad that fought the
       browser's own idea of the gesture and swipes went wrong more often
       than right. */
    let down = false;
    /* How many fingers are on the glass. `down` is a mouse's only — the
       drag above is for a mouse and hands the touchscreen to the platform
       — so nothing here knew a finger was still on the strip. The settle
       below is armed by the scroll events a swipe makes and fires 160ms
       after the last one: hold still mid-swipe without lifting and it
       re-centred the strip under the hand. That is the jump on the iPad. */
    let held = 0;
    let dragging = false;
    let fromX = 0;
    let fromScroll = 0;
    let lastX = 0;
    let lastAt = 0;
    let speed = 0;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      // A field is for typing and selecting in, not for pulling the page.
      const at = e.target as Element | null;
      if (at?.closest?.("input, textarea, select, label")) return;
      /* A `[data-scroll]` box is not excluded as a whole. It used to be, and
         the Biography panel on /about is one box from edge to edge, so a
         drag back to the first panel only took from its margins: Julian
         found it buggy. The wheel is what the box scrolls with; a mouse
         pulling sideways means the strip. Only a press on the box's own
         scrollbar is left to the box. */
      if (
        at instanceof HTMLElement &&
        at.hasAttribute("data-scroll") &&
        e.offsetX >= at.clientWidth
      ) {
        return;
      }
      down = true;
      dragging = false;
      size();
      stop();
      fromX = lastX = e.clientX;
      fromScroll = el.scrollLeft;
      lastAt = e.timeStamp;
      speed = 0;
      delete el.dataset.dragged;
    };

    const onMove = (e: PointerEvent) => {
      if (!down) return;
      const dt = e.timeStamp - lastAt;
      // px per ms, positive when the sequence is being pulled leftwards.
      if (dt > 0) speed = (lastX - e.clientX) / dt;
      lastX = e.clientX;
      lastAt = e.timeStamp;
      const want = fromScroll - (e.clientX - fromX);
      target = clamp(want);
      el.scrollLeft = target;
      // Whatever the clamp refused is the band: pull past an end and it
      // gives, and holds where the hand holds it while the loop is stopped.
      push(want - target - over);

      /* Past a few pixels this is a drag rather than a press, and two
         things change. The frame under the pointer must not open when the
         button comes back up. And the pointer is captured, so a hand that
         leaves the strip mid-pull keeps pulling it.

         Capture only from here, never on the press itself: capturing
         retargets the compatibility mouse events too, so the `click` that
         follows is delivered to the scroller instead of the frame — which
         is exactly how the first version of this stopped the lightbox from
         opening at all. */
      if (!dragging && Math.abs(e.clientX - fromX) > 4) {
        dragging = true;
        el.dataset.dragged = "";
        el.setPointerCapture(e.pointerId);
      }
    };

    const onUp = () => {
      if (!down) return;
      down = false;
      dragging = false;
      // After the click that this release is about to fire, not before.
      requestAnimationFrame(() => delete el.dataset.dragged);

      // A flick keeps going: let go at a speed, the strip carries on at
      // that speed and runs out under the same friction as a notch.
      // Julian: drag to the next and the page before. Let go pulled past
      // an end as far as a finger has to, and it leads on as a swipe does.
      if (over >= LEAVE_TOUCH) return leave(1);
      if (over <= -LEAVE_TOUCH) return leave(-1);
      if (eased && Math.abs(speed) > 0.05) to(el.scrollLeft + speed * TAU);
      // Paged, a release lands on a screen rather than wherever the throw
      // ran out: the page is the unit, so it is what the hand is holding.
      if (eased && paged) {
        const where = centreOf(el, nearest(target));
        if (where !== null) to(where);
      }
    };

    // The browser took the pointer away mid-drag.
    const onCancel = () => {
      if (!down) return;
      down = false;
      dragging = false;
      requestAnimationFrame(() => delete el.dataset.dragged);
    };

    const onHold = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") held++;
    };
    const onLet = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      held = Math.max(0, held - 1);
      // The last scroll event may already have gone by; arm it again.
      if (!held) onSettle();
    };

    const swallowClick = (e: MouseEvent) => {
      if (el.dataset.dragged === undefined) return;
      e.preventDefault();
      e.stopPropagation();
    };

    /** The cell whose centre is nearest a scroll position. */
    const nearest = (where: number) => {
      const middle = where + el.clientWidth / 2;
      let best = 0;
      let near = Infinity;
      Array.from(el.children).forEach((c, i) => {
        const cell = c as HTMLElement;
        const off = Math.abs(leftOf(cell) + cell.offsetWidth / 2 - middle);
        if (off < near) {
          near = off;
          best = i;
        }
      });
      return best;
    };

    /* The keyboard, on the scroller itself and nowhere inside it: arrows
       step a cell, Home and End go to the ends. A key pressed in a field
       within a cell is that field's. */
    const onKey = (e: KeyboardEvent) => {
      if (e.target !== el) return;
      const last = el.children.length - 1;
      /* Where the strip is going, not where it is: three quick presses
         should step three cells, and each one read the cell in the middle
         of the window while the glide from the press before it was still
         on its way there. */
      const at = nearest(target);
      const i =
        e.key === "ArrowRight"
          ? Math.min(last, at + 1)
          : e.key === "ArrowLeft"
            ? Math.max(0, at - 1)
            : e.key === "Home"
              ? 0
              : e.key === "End"
                ? last
                : null;
      if (i === null) return;
      e.preventDefault();
      // The ends themselves for Home and End: the last cell is often
      // narrower than half a window, so its centre is short of the end.
      const where = i === 0 ? 0 : i === last ? room() : centreOf(el, i);
      if (where !== null) to(where);
    };

    /* A scroll the strip did not start — a sideways trackpad swipe, a
       touch drag, a scrollbar — settles on a section rather than wherever
       it ran out. The wheel and the drag are paged by hand above; this is
       every other way the box can be moved, and without it a page could
       sit with two sections half on screen and nothing to pull it
       straight. It waits for the movement to stop, so it never fights the
       gesture, and it does nothing while the strip is driving itself. */
    let settle = 0;
    /* The screen a paged strip last came to rest on. */
    let seat = paged ? nearest(el.scrollLeft) : 0;
    const onSettle = () => {
      if (!paged || !eased) return;
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        if (down || held || dragging || frame || leaving) return;
        seat = nearest(el.scrollLeft);
        const where = centreOf(el, seat);
        if (where !== null && Math.abs(where - el.scrollLeft) > 2) to(where);
      }, 160);
    };
    /* Turned on its side, or the window resized, a paged strip stays on
       the screen it was on: the scroll kept its pixels, which at the new
       width stood two thirds of the way between two screens (an iPad on
       the homepage). A frame on, once the deck has laid its screens out
       again at the new width. */
    /* Julian (2026-10-01): the site should scale smoothly while the window
       is dragged. It reseated a frame late, so every frame of a drag was
       painted first at the old pixels, between two screens (154 frames in
       a sweep, up to 640px off), and then jumped. Here it is put back in
       the observer, after the new layout and before that frame is
       painted.

       A strip that is not paged (the portfolio) kept its pixels too, and
       its grid reflows at a new size, so a drag ended 2300px from the
       work it was on. It holds the cell at its left edge where it was
       instead, the way a page keeps its place when it reflows downwards:
       noted whenever the strip comes to rest, put back on a resize. */
    let across = el.clientWidth;
    let tall = el.clientHeight;
    let anchor = { i: 0, off: 0 };
    const note = () => {
      const kids = el.children;
      for (let i = 0; i < kids.length; i++) {
        const cell = kids[i] as HTMLElement;
        const left = leftOf(cell);
        if (left + cell.offsetWidth > el.scrollLeft + 1) {
          anchor = { i, off: left - el.scrollLeft };
          return;
        }
      }
    };
    let noting = 0;
    const onNote = () => {
      window.clearTimeout(noting);
      noting = window.setTimeout(note, 120);
    };
    note();
    /* Moved off the start or not, for what stands at the start
       (`chapter-alias`, `work-cells.tsx`: the portfolio's first spine
       reads Portfolio there and its own name once the strip moves). Marked
       moved rather than at the start, so the page as it first draws, the
       frame the window's flight lands on, is at the start. */
    const onStart = () => el.toggleAttribute("data-moved", el.scrollLeft >= 8);
    onStart();
    const reseat = () => {
      if (el.clientWidth === across && el.clientHeight === tall) return;
      across = el.clientWidth;
      tall = el.clientHeight;
      if (paged) {
        const where = centreOf(el, seat);
        if (where !== null) el.scrollLeft = where;
      } else {
        const cell = el.children[anchor.i] as HTMLElement | undefined;
        if (cell) el.scrollLeft = leftOf(cell) - anchor.off;
      }
      x = target = el.scrollLeft;
    };


    /* Tab into a section that is off screen and the browser jumps the box
       to it: instantly, and to wherever it takes to get the element in
       view, which on a paged page is usually between two sections. So the
       jump is put back and the strip travels there itself. Only for the
       keyboard — a press focuses what it presses, and recentring under a
       click would be the page moving for no reason. */
    let beforeTab = -1;
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      beforeTab = el.scrollLeft;
      window.setTimeout(() => {
        beforeTab = -1;
      }, 0);
    };
    const onFocusIn = (e: FocusEvent) => {
      const node = e.target as Node | null;
      if (beforeTab < 0 || !node || node === el || !el.contains(node)) return;
      const i = Array.from(el.children).findIndex((c) => c.contains(node));
      const where = i < 0 ? null : centreOf(el, i);
      if (where === null) return;
      el.scrollLeft = beforeTab;
      beforeTab = -1;
      if (Math.abs(where - el.scrollLeft) > 2) to(where);
    };

    /* The way back to the top of a page that has no top. The wordmark in
       the header is that way on every other page; here it dispatches this
       at the scroller instead of scrolling a document that never moves,
       and the strip travels home under the same friction as a wheel
       notch rather than cutting there. */
    const onHome = () => to(0);

    // And whenever the scroller changes shape: a window resized, the rack
    // swapped for the strip, a cell arriving.
    const resized = new ResizeObserver(() => {
      size();
      reseat();
    });
    resized.observe(el);

    el.addEventListener("jg:home", onHome);
    el.addEventListener("scroll", onSettle, { passive: true });
    el.addEventListener("scroll", onNote, { passive: true });
    el.addEventListener("scroll", onStart, { passive: true });
    el.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onTab, true);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("pointerdown", onHold, { passive: true });
    el.addEventListener("pointerup", onLet, { passive: true });
    el.addEventListener("pointercancel", onLet, { passive: true });
    el.addEventListener("click", swallowClick, true);
    el.addEventListener("keydown", onKey);
    // A touchscreen writes `scrollLeft` itself; the target has to follow,
    // or the next wheel notch would spring back.
    const sync = () => {
      if (!down && !frame) target = el.scrollLeft;
    };
    el.addEventListener("scroll", sync, { passive: true });

    return () => {
      cancelAnimationFrame(firstSize);
      window.clearTimeout(settle);
      resized.disconnect();
      wall?.cancel();
      window.clearTimeout(noting);
      el.removeEventListener("jg:home", onHome);
      el.removeEventListener("scroll", onSettle);
      el.removeEventListener("scroll", onNote);
      el.removeEventListener("scroll", onStart);
      el.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onTab, true);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("pointerdown", onHold);
      el.removeEventListener("pointerup", onLet);
      el.removeEventListener("pointercancel", onLet);
      el.removeEventListener("click", swallowClick, true);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("scroll", sync);
      if (frame) cancelAnimationFrame(frame);
      if (band) cancelAnimationFrame(band);
      el.style.translate = "";
      delete el.dataset.release;
    };
  }, [router, nextHref, prevHref, prevStart, live, paged, deck]);

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
  React.useEffect(() => {
    if (!chaptered || !onRail) return;
    let frame = 0;
    const step = () => {
      const x = lastX.current;
      if (x !== null) setOver(hit.current(x));
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
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
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
  };
  const railMove = (e: React.PointerEvent<HTMLDivElement>) => {
    window.clearTimeout(linger.current);
    lastX.current = e.clientX;
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
        /* Dealt as a deck: `globals.css` makes every cell opaque. */
        data-dealt={deck}
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
                    style={{
                      flexGrow: shown
                        ? mine
                          ? OPEN_SHARE
                          : opening(count)
                        : 1,
                    }}
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
                          "label pointer-events-none absolute bottom-full mb-1 whitespace-nowrap text-[0.625rem] transition-opacity duration-200",
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
