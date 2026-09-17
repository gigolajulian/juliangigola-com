"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn, rubberband } from "@/lib/utils";

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
};

/** Set by a strip on its way out backwards and read by the next one on its
    way in, so the previous sequence arrives from the left and opens at its
    end, which is the side the visitor came in by. Module state rather than
    storage: it only has to survive one client navigation. */
let cameBack = false;

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
const FILTER_MS = 1200;

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

/** How far past the end a wheel has to push before it leads on, in px of
    wheel delta. Three notches on a mouse: an overshoot of one is a
    reader arriving at the end, not asking to leave it. */
const LEAVE_AFTER = 300;
/** The quiet that ends a swipe. A trackpad fires every frame or so while
    the fingers are down and keeps firing as the fling decays, so anything
    under about a tenth of a second is still the same push. */
const GESTURE_GAP_MS = 120;
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

/** Where a strip stops being a strip. Under this the cells of a stacking
    page run down the screen and the machine is off; the value is the
    `sm` breakpoint, the same one `globals.css` unlocks the page at. */
const WIDE = "(min-width: 40rem)";
const subscribeWide = (onChange: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const useWide = () =>
  React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    // The server draws the wide page; a phone corrects itself on hydration.
    () => true,
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

/** The scroll position that puts cell `i` in the middle of the window. */
const centreOf = (el: HTMLElement, i: number) => {
  const cell = el.children[i] as HTMLElement | undefined;
  if (!cell) return null;
  return cell.offsetLeft - (el.clientWidth - cell.offsetWidth) / 2;
};

/**
 * Which cell a hash names.
 *
 * A cell's own `data-hash` first, and failing that any `data-hash` or `id`
 * inside one: a page's sections are not always cells — the studio's ask and
 * its client list live inside the screen they belong to, and `/legal` is a
 * column of headings — and a hash that names one of those should still bring
 * the cell holding it into view rather than doing nothing at all.
 */
const cellFor = (el: HTMLElement, hash: string): number => {
  if (!hash) return -1;
  const cells = Array.from(el.children) as HTMLElement[];
  const own = cells.findIndex((c) => c.dataset.hash === hash);
  if (own >= 0) return own;
  const safe = CSS.escape(hash);
  return cells.findIndex(
    (c) => c.querySelector(`[data-hash="${safe}"], #${safe}`) !== null,
  );
};

export function Strip({
  children,
  label,
  next,
  prev,
  onOpen,
  counter,
  marks,
  stack = true,
  paged = false,
  bleed = false,
  arrive,
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
  /**
   * Marks by key, drawn in the panel when the cell in the middle names one
   * in `data-mark`.
   *
   * A map of nodes and not a function of the index, because the pages that
   * want this are server components and a function cannot cross that
   * boundary - rendered nodes can.
   */
  marks?: Record<string, React.ReactNode>;
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
  /** The scroller, for a lightbox that lifts frames out of it. */
  ref?: React.Ref<HTMLDivElement | null>;
  className?: string;
}) {
  const scroller = React.useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => scroller.current!, []);
  const [at, setAt] = React.useState(0);
  /** The key of the mark the cell in the middle names, if it names one. */
  const [mark, setMark] = React.useState("");
  const [ticks, setTicks] = React.useState<{ i: number; word?: string }[]>([]);
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
  const router = useRouter();
  // Stable for the life of the strip: pages key it by what it shows.
  const nextHref = next?.href;
  const prevHref = prev?.href;
  const open = React.useRef(onOpen);
  React.useEffect(() => {
    open.current = onOpen;
  });
  const count = React.Children.count(children);

  /* Before the first paint: a deep link opens on its cell, and arriving
     backwards opens at the end with the slide coming from the left. Both
     before paint so the arrival animation is created with the right
     direction and there is never a frame of the strip somewhere else. */
  React.useLayoutEffect(() => {
    const back = cameBack;
    cameBack = false;
    const filtered = Date.now() - filteredAt < FILTER_MS;
    filteredAt = 0;
    const popped = Date.now() - poppedAt < POP_MS;
    const el = scroller.current;
    if (!el || !live) return;
    // The filter changed under a row that stayed: a fade, not an arrival.
    if (filtered) {
      el.dataset.arrive = "fade";
      /* Half a screen at the very ends of the row, nothing at all for a
         press on the chip already lit. The CSS reads it; a shift of zero
         leaves the old still fade exactly as it was. */
      el.style.setProperty("--fade-from", `${(filterShift * 5).toFixed(2)}vw`);
    }
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) {
      const i = cellFor(el, hash);
      const where = i >= 0 ? centreOf(el, i) : null;
      if (where !== null) {
        el.scrollLeft = where;
        return;
      }
    }
    /* Back, to a path this strip has been on before: the seat it was left
       in. No animation with it — coming back to where you were is not an
       arrival, and a sequence that slid in from the right while sitting at
       its sixth cover would read as a new page that is already scrolled. */
    if (popped) {
      const seated = Number(
        (() => {
          try {
            return window.sessionStorage.getItem(seat(window.location.pathname));
          } catch {
            return null;
          }
        })(),
      );
      if (seated > 0) {
        el.dataset.arrive = "none";
        el.scrollLeft = seated;
        return;
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
      el.dataset.arrive = "back";
      el.scrollLeft = el.scrollWidth;
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
    const land = (i: number) => {
      atRef.current = i;
      setAt(i);
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
      for (let k = el.scrollLeft <= 2 ? -1 : i; k >= 0; k--) {
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
         picture with no way out. */
      const want = section?.dataset.hash ? `#${section.dataset.hash}` : "";
      if (
        want !== window.location.hash &&
        document.documentElement.dataset.viewer === undefined
      ) {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${window.location.search}${want}`,
        );
      }
      /* The mark belongs to the cell itself and not to the chapter it is
         in: a client is the client of one project. */
      setMark((el.children[i] as HTMLElement).dataset.mark ?? "");
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
    const soften = new WeakMap<HTMLElement, { n: number; list: HTMLElement[] }>();
    const fades = (cell: HTMLElement) => {
      const had = soften.get(cell);
      if (had && had.n === cell.childElementCount) return had.list;
      const list = (Array.from(cell.children) as HTMLElement[]).filter(
        (c) => !c.querySelector("img, video, picture, .strip-frame"),
      );
      soften.set(cell, { n: cell.childElementCount, list });
      return list;
    };
    /* Reduced motion keeps the words at full strength, which is what the
       stylesheet used to say. */
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const read = () => {
      queued = 0;
      // Where to sit somebody down if they come back to this path.
      seatX.current = Math.round(el.scrollLeft);
      const room = el.scrollWidth - el.clientWidth;
      /* Whether the opening cell has gone. A page's running head waits for
         this: the sequence opens on its title set large, and two titles on
         one screen is the same words twice. Half the cell's width, so the
         swap happens as it leaves rather than after it has. The rule that
         reads this is in `globals.css`. */
      const first = el.firstElementChild as HTMLElement | null;
      el.toggleAttribute(
        "data-past-first",
        !!first && el.scrollLeft > first.offsetLeft + first.offsetWidth * 0.5,
      );
      /* Either end is that end's cell, whatever is nearest the middle.
         At the far end the last cell is often narrower than half a window,
         so the middle of the window sits over the one before it and the
         counter could never reach the last cell at all. */
      const middle = el.scrollLeft + el.clientWidth / 2;
      const kids = Array.from(el.children) as HTMLElement[];
      // Every read before any write, or each write would cost a layout.
      const offs = kids.map((c) => c.offsetLeft + c.offsetWidth / 2 - middle);
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
        const par = off / el.clientWidth;
        const away = Math.min(1, Math.abs(par));
        const soft = fades(kids[i]);
        if (Math.abs(par) > 1.5) {
          for (const c of soft) if (c.style.opacity) c.style.opacity = "";
        } else if (!still) {
          const o = Math.max(0, Math.min(1, (1 - away) / 0.45)).toFixed(2);
          for (const c of soft) if (c.style.opacity !== o) c.style.opacity = o;
        }
      });
      if (el.scrollLeft >= room - 2) land(kids.length - 1);
      else if (el.scrollLeft <= 2) land(0);
      else land(best);
    };
    /* The ruler's ticks, read off the cells once they are in the DOM: a
       cell is often a component of its own, so its attributes are not on
       the element the strip is handed. Set only when they change. */
    const readTicks = () => {
      const t = (Array.from(el.children) as HTMLElement[]).flatMap((c, i) =>
        c.dataset.tick !== undefined ? [{ i, word: c.dataset.label }] : [],
      );
      const key = t.map((x) => `${x.i}:${x.word ?? ""}`).join("|");
      if (key === tickKey.current) return;
      tickKey.current = key;
      setTicks(t);
    };
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(read);
    };
    // A hash changed underfoot (a chip on /work is a plain anchor): glide.
    const onHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const i = cellFor(el, hash);
      const where = i >= 0 ? centreOf(el, i) : null;
      if (where !== null) glide.current(where);
    };
    // A frame later rather than now, so the first render is not followed
    // by a second one in the same tick.
    queued = requestAnimationFrame(() => {
      readTicks();
      read();
    });
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", read);
    window.addEventListener("hashchange", onHash);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", read);
      window.removeEventListener("hashchange", onHash);
      if (queued) cancelAnimationFrame(queued);
    };
  }, [live, count]);

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

    const room = () => el.scrollWidth - el.clientWidth;
    const clamp = (v: number) => Math.min(room(), Math.max(0, v));
    let target = el.scrollLeft;
    let frame = 0;
    // Where the strip is and how fast it is going, in px and px per ms.
    let x = el.scrollLeft;
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
    const paint = () => {
      if (leaving) return;
      // Three notches read 48, 94 and 136px, so the band is still growing
      // at the moment it goes. It was half that and Julian said it did not
      // feel like a rubber band: give that cannot be seen is a stop.
      const pull = eased && over ? rubberband(over, el.clientWidth, 0.5) : 0;
      el.style.translate = pull
        ? `${-Math.max(-STRETCH, Math.min(STRETCH, pull))}px`
        : "";
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
    /** Lets the band go: CSS springs it back (`[data-release]` in
        `globals.css`), so nothing here paints the return frame by frame. */
    const release = () => {
      if (leaving || "release" in el.dataset) return;
      el.dataset.release = "";
      el.style.translate = "";
    };
    const relax = (now: number) => {
      if (now - pushed > HOLD) {
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

    /** Aims the strip: sets the speed that runs out exactly at `where`. */
    const to = (where: number) => {
      target = clamp(where);
      if (!eased) {
        el.scrollLeft = target;
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
    const arrived = performance.now();
    /* Two filters of the work index are one page with the row swapped, not
       two pages. */
    const filterPath = (path: string) =>
      path === "/work" ||
      path === "/work/video" ||
      path.startsWith("/work/category/");

    const leave = (dir: 1 | -1) => {
      const href = dir > 0 ? nextHref : prevHref;
      if (!href || leaving || performance.now() - arrived < 500) return;
      leaving = true;
      // The band holds where it is and the slide starts from it.
      if (band) cancelAnimationFrame(band);
      band = 0;
      /* Places to Motion was a page leaving and a page arriving: the strip
         slid off, and for the 260ms it took the screen was bare paper —
         measured on production, mean brightness at 235.8 with nothing on
         it from 457ms to 718ms. Between two filters the head and the chip
         row do not change, so there is nothing to leave: the row is
         swapped where it stands, the way a chip press does it, and the
         push goes out at once. */
      if (filterPath(window.location.pathname) && filterPath(href)) {
        markFilter(dir);
        cameBack = dir < 0;
        router.push(href);
        return;
      }
      el.dataset.leaving = dir > 0 ? "on" : "back";
      cameBack = dir < 0;
      window.setTimeout(() => router.push(href), 260);
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

    const onWheel = (e: WheelEvent) => {
      // A pinch is a zoom.
      if (e.ctrlKey) return;
      const now = e.timeStamp || performance.now();
      const fresh = now - gestureAt > GESTURE_GAP_MS;
      gestureAt = now;
      const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const raw = sideways ? e.deltaX : e.deltaY;
      if (!raw) return;
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
        push(dy);
        // Past the end, on; past the start, back. Julian asked for both.
        if (over >= LEAVE_AFTER) leave(1);
        if (over <= -LEAVE_AFTER) leave(-1);
        return;
      }
      e.preventDefault();
      // A notch the other way lets go of the band, and of the count.
      if (over) {
        over = 0;
        release();
      }
      /* Paged: the gesture means the next screen, whatever its size. A
         trackpad sends a stream of small deltas for one swipe and a mouse
         one large notch for one turn, so the move is locked for as long as
         it takes to land — otherwise a single swipe would fly through four
         sections. */
      if (paged) {
        const now = performance.now();
        const notch = Math.abs(dy) >= 80;
        if (now < locked) {
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
    let dragging = false;
    let fromX = 0;
    let fromScroll = 0;
    let lastX = 0;
    let lastAt = 0;
    let speed = 0;

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      // A field is for typing and selecting in, not for pulling the page.
      if (
        (e.target as Element | null)?.closest?.(
          "input, textarea, select, label, [data-scroll]",
        )
      ) {
        return;
      }
      down = true;
      dragging = false;
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

      // A flick keeps going: let go at a speed, the strip carries on at
      // that speed and runs out under the same friction as a notch. A drag
      // past the end springs back and never leads on: a grab that threw
      // you into another page would be a surprise, and the wheel is the
      // gesture that travels.
      if (eased && Math.abs(speed) > 0.05) to(el.scrollLeft + speed * TAU);
      // Paged, a release lands on a screen rather than wherever the throw
      // ran out: the page is the unit, so it is what the hand is holding.
      if (eased && paged) {
        const where = centreOf(el, nearest(target));
        if (where !== null) to(where);
      }
      // After the click that this release is about to fire, not before.
      requestAnimationFrame(() => delete el.dataset.dragged);
    };

    // The browser took the pointer away mid-drag.
    const onCancel = () => {
      if (!down) return;
      down = false;
      dragging = false;
      requestAnimationFrame(() => delete el.dataset.dragged);
    };

    const swallowClick = (e: MouseEvent) => {
      if (el.dataset.dragged === undefined) return;
      e.preventDefault();
      e.stopPropagation();
    };

    // A press on a numbered button opens it. Delegated, so a page can build
    // its cells once and the opener is reached through a ref.
    const openCell = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.<HTMLElement>(
        "[data-n]",
      );
      if (b && el.contains(b)) open.current?.(Number(b.dataset.n));
    };

    /** The cell whose centre is nearest a scroll position. */
    const nearest = (where: number) => {
      const middle = where + el.clientWidth / 2;
      let best = 0;
      let near = Infinity;
      Array.from(el.children).forEach((c, i) => {
        const cell = c as HTMLElement;
        const off = Math.abs(cell.offsetLeft + cell.offsetWidth / 2 - middle);
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
    const onSettle = () => {
      if (!paged || !eased) return;
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        if (down || dragging || frame || leaving) return;
        const where = centreOf(el, nearest(el.scrollLeft));
        if (where !== null && Math.abs(where - el.scrollLeft) > 2) to(where);
      }, 160);
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

    el.addEventListener("jg:home", onHome);
    el.addEventListener("scroll", onSettle, { passive: true });
    el.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onTab, true);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onCancel);
    el.addEventListener("click", swallowClick, true);
    el.addEventListener("click", openCell);
    el.addEventListener("keydown", onKey);
    // A touchscreen writes `scrollLeft` itself; the target has to follow,
    // or the next wheel notch would spring back.
    const sync = () => {
      if (!down && !frame) target = el.scrollLeft;
    };
    el.addEventListener("scroll", sync, { passive: true });

    return () => {
      window.clearTimeout(settle);
      el.removeEventListener("jg:home", onHome);
      el.removeEventListener("scroll", onSettle);
      el.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onTab, true);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onCancel);
      el.removeEventListener("click", swallowClick, true);
      el.removeEventListener("click", openCell);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("scroll", sync);
      if (frame) cancelAnimationFrame(frame);
      if (band) cancelAnimationFrame(band);
      el.style.translate = "";
      delete el.dataset.release;
    };
  }, [router, nextHref, prevHref, live, paged]);

  /** Puts a cell in the middle of the window. */
  const goTo = (i: number) => {
    const el = scroller.current;
    const where = el ? centreOf(el, i) : null;
    if (where !== null) glide.current(where);
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div
        ref={scroller}
        tabIndex={0}
        aria-label={label}
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
        /* The whole shelf is draggable, so the pointer says so; a cover
           inside it has its own word and a cell of words cancels it. */
        data-ring="Drag"
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
            "max-sm:animate-none max-sm:flex-col max-sm:items-stretch max-sm:gap-10 max-sm:overflow-visible max-sm:select-auto",
          // Stacked, a full-bleed page still wants its words off the edge.
          bleed && stack && "max-sm:gap-0",
        )}
      >
        {children}
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
          /* `min-h-5`, so the row is the same height with a client's mark
             in it and without one: the strip above is `flex-1` and would
             otherwise give up four pixels every time a mark appeared. */
          "mt-6 flex min-h-5 items-end gap-6 px-6 sm:px-10",
          stack && "max-sm:hidden",
        )}
      >
        {counter?.(at)}
        {/* Who the cover in the middle was shot for. It sits at the end of
            the ruler's own line, so it reads as part of the instrument
            rather than as a badge dropped on the page. */}
        {marks?.[mark] ?? null}

        <div
          aria-hidden
          // `h-4` whether or not the ticks are in yet, so the strip above is
          // the same height before and after they are read.
          className="flex h-4 min-w-0 flex-1 items-end justify-between gap-px"
        >
          {ticks.map(({ i, word }, n) => {
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
                title={word}
                onClick={() => goTo(i)}
                className="group relative flex h-4 flex-1 items-end"
              >
                {word ? (
                  <span
                    className={cn(
                      "label pointer-events-none absolute bottom-full mb-1 whitespace-nowrap text-[0.625rem] text-muted-foreground transition-opacity duration-200",
                      end ? "right-0" : "left-0",
                      i === at
                        ? "opacity-100"
                        : "opacity-0 hoverable:group-hover:opacity-100",
                    )}
                  >
                    {word}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "block w-full rounded-full transition-[height,background-color] duration-200 ease-[var(--ease-out-strong)]",
                    i === at
                      ? "h-4 bg-foreground"
                      : "h-1 bg-foreground/20 hoverable:group-hover:h-1.5 hoverable:group-hover:bg-foreground/40",
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
