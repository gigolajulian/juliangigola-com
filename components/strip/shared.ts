/* ── what every part of the strip shares ──────────────────────────
 * The strip (`components/strip.tsx`) is split into the files beside this
 * one. This holds what more than one of them reads: how the last strip
 * left and how this one got here, the tuning of the wheel and the band,
 * and where a cell sits.
 * ─────────────────────────────────────────────────────────────── */

/** How the strips hand over to each other across one client navigation.
    Module state rather than storage: it only has to survive one client
    navigation and nothing more. */
export const nav = {
  /** Set by a strip on its way out backwards and read by the next one on
      its way in, so the previous sequence arrives from the left and opens
      at its end, which is the side the visitor came in by. */
  cameBack: false,
  /** Which way the last strip led on, so the next one can tell the tail
      of that push from a new one. Never cleared: the window it is read in
      is the second after the strip mounts, and a cold load has nothing
      set. */
  arriveDir: 0 as 1 | -1 | 0,

  /* ── a filter change, and a way back to your seat ──
     Two more things a strip wants to know about how it got here. */

  /** When a filter chip was last pressed, and which way along the row it
      was from the chip that was lit. A strip mounting just after one
      fades in where it stands rather than sliding in from a quarter of
      the window: the filter row is above it and did not move, so the
      sequence under it changing is not a page arriving.

      The direction is the whole of what Julian asked for: press a chip to
      the right of the one that is lit and the new sequence comes in from
      the right, as though the row and the work under it were one thing
      you were moving along. `filterShift` is how far along the row the
      press was, as a share of the row's width, so a neighbour slides a
      little and a chip at the far end slides the most. */
  filteredAt: 0,
  filterShift: 0,
  /** When a strip last led on as a card (`deck="leads"`): the strip that
      mounts next is the card, and names itself for the trip. Generous,
      because the next page can take seconds to come in (a cold Worker, a
      route compiling on dev) and the deal has to survive the wait. It
      used to be a second and a half, and a slow page lost the deal: the
      strip froze and the next one popped in. Julian saw it often. */
  dealtAt: 0,
  /** When the browser last went back or forward. A strip mounting just
      after one puts the visitor back where they were on this path instead
      of at the beginning: leaving Portraits five covers in to look at one
      project and returning to the first cover is losing somebody's place
      in a sequence they were reading. */
  poppedAt: 0,
  /** When a press last went to a place inside a page (`/#about`): the
      strip that mounts for it is whole, since the address it is read from
      still holds the page being left while it renders. */
  aimedAt: 0,
  /** Whether the app has hydrated: a strip mounting before then is the
      server's markup and must match it whole; one mounting after is a
      navigation and may hold its far cells back (`defer`). */
  hydrated: false,
};

export const markFilter = (shift = 0) => {
  nav.filteredAt = Date.now();
  nav.filterShift = Math.max(-1, Math.min(1, shift));
};
// Read once by the strip that mounts next, so it can wait out a slow page.
export const FILTER_MS = 10000;
export const DEAL_MS = 10000;
export const POP_MS = 1500;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    // Not the photo viewer closing on the back button (`lib/zoom.ts`).
    if (document.documentElement.dataset.viewer === undefined)
      nav.poppedAt = Date.now();
  });
}
/** Where a path's strip was when it was last left. */
export const seat = (path: string) => `strip-at:${path}`;

/** The cells a deferring strip mounts with: up to the third section. */
export const SECTIONS_FIRST = 2;
if (typeof window !== "undefined") {
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
      if (a && a.origin === location.origin && a.hash) nav.aimedAt = Date.now();
    },
    true,
  );
}

/** How far past the end a wheel has to push before it leads on, in px
    of wheel delta. Three notches on a mouse: an overshoot of one is a
    reader arriving at the end, not asking to leave it. Halved from
    300. */
export const LEAVE_AFTER = 150;
/** Fired on the scroller when the rack has laid its frames out again. */
export const RELAID = "strip-relaid";
/* A finger's pull past the end before the strip leads on. Shorter than
   the wheel's, because a wheel notch is worth tens of pixels and a
   finger is worth the distance it actually moved. 80px, then 50. */
export const LEAVE_TOUCH = 50;

/** Lenis, on for everyone. It carries the wheel on every sequence that
    runs sideways; `?lenis=0` turns it off for this browser and every page
    after it, and `?lenis=1` turns it back on. Read at the moment an effect
    runs rather than held in state, so the markup is the same either way
    and nothing has to hydrate around it. A browser that refuses storage
    gets it too: the default is the site, not the fallback. */
const LENIS_KEY = "strip-lenis";
export function wantsLenis() {
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
export const GESTURE_GAP_MS = 120;
/** Whether the gesture under way on a strip is a trackpad's. Decided per
    gesture, not per event: a fast swipe can open with an event the size of
    a notch, and with that one given to Lenis and the rest moved directly
    the two fought, and the landing read Lenis's target and took the strip
    back to the start. The strip's `onWheel` sets it, Lenis reads it. */
export const padGesture = new WeakMap<HTMLElement, boolean>();
/** Preview (`?notch`): a mouse notch moves the strip by its own ease,
    as a trackpad does, rather than by Lenis's. Paged, the notch slides
    to the next screen (`PAGE_MS`); free, it is the strip's own
    momentum, as under `?lenis=0`. Read once, as a strip mounts. */
export const wantsOwnNotch = () =>
  new URLSearchParams(window.location.search).has("notch");
/** How long a push is held after the last notch before it starts to drain,
    so the notches of a steady spin add up rather than leak away between
    them: a notched wheel fires about ten times a second, and a drain that
    ran through the gaps levelled a spin off short of LEAVE_AFTER. Then
    RELAX is the spring: the time in which the held push falls to a third
    once the hand has stopped. Fast, because a band that takes a second to
    come back reads as the page being stuck, not as give. */
export const HOLD = 200;
export const RELAX = 120;
/** The most the band ever shows, in px. Resistance, not travel. */
export const STRETCH = 160;
/** How far a wheel event carries the strip, as a multiple of its delta.
    Two gains, because a mouse and a trackpad are not the same instrument:
    a mouse notch is a hundred px of delta in one event, a trackpad's swipe
    is dozens of small ones. A sequence is four to nine thousand px wide,
    and at one to one a mouse took forty notches to cross it; at 1.8 Julian
    still said the pages took too long to scroll through on a mouse. So a
    notch carries three times its delta and a trackpad's events under it
    keep the gentler gain. The band's count stays in raw delta, so neither
    makes leaving any easier. */
export const WHEEL = 3;
export const PAD = 1.8;
/** Lenis's ease per frame for a notch (a trackpad is not eased: `isPad`).
    A notch was 0.08, which took about 460ms to cover nine tenths of its
    travel and read as lag even at a full frame rate (Julian: the portfolio
    is laggy on a desktop); 0.13 takes about 270. */
export const MOUSE_LERP = 0.13;
/** A line of a line-mode wheel (Firefox's mouse), in px: the strip's own
    count, and Lenis's, which it is brought up to. */
export const LINE = 40;
export const LENIS_LINE = 100 / 6;

/** Where a cell sits in layout. A cell dealt as a deck (`lib/deck.ts`) is
    `position: sticky`, and Chrome folds the sticky offset into a stuck
    cell's `offsetLeft`, so a pinned cover read as sitting exactly where
    the screen over it did and the paging never moved on. The deck stamps
    the layout position on the cell; the rest read `offsetLeft`. */
export const leftOf = (cell: HTMLElement) =>
  cell.dataset.at !== undefined ? Number(cell.dataset.at) : cell.offsetLeft;

/** The scroll position that puts cell `i` in the middle of the window. */
export const centreOf = (el: HTMLElement, i: number) => {
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
 * inside one: a page's sections are not always cells - the studio's ask and
 * its client list live inside the screen they belong to, and `/legal` is a
 * column of headings - and a hash that names one of those should still bring
 * the cell holding it into view rather than doing nothing at all.
 *
 * Last, a photograph by its file: `/portfolio/nyx#photo-06` opens on
 * `/work/nyx/06.jpg` wherever it sits in the sequence. The colour panel
 * links that way, because a position would move whenever a project's
 * opener changes and a file name does not.
 */
export const cellFor = (el: HTMLElement, hash: string): number => {
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
