import * as React from "react";
import { STRIP_SECTION } from "@/lib/utils";
import { createBench } from "./keyboard";
import { cellFor, centreOf, leftOf, RELAID } from "./shared";

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

export type Tick = { i: number; word?: string; name?: string; tint?: string };

/**
 * Reads the strip as it moves: which cell is in the middle (`setAt`),
 * the rail's ticks (`setTicks`), whether it has stopped (`setStill`),
 * the address and the running head, the words fading with their cells,
 * and Tab kept on screen. And glides to a cell the address names.
 */
export function useReader({
  scroller: scrollerRef,
  live,
  count,
  paged,
  atRef,
  setAt,
  setTicks,
  tickKey: tickKeyRef,
  setStill,
  setAim,
  seatX: seatXRef,
  glide: glideRef,
  aimed: aimedRef,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  live: boolean;
  count: number;
  paged: boolean;
  atRef: React.RefObject<number>;
  setAt: (i: number) => void;
  setTicks: (t: Tick[]) => void;
  tickKey: React.RefObject<string>;
  setStill: (still: boolean) => void;
  setAim: (aim: number | null) => void;
  seatX: React.RefObject<number>;
  glide: React.RefObject<(to: number) => void>;
  aimed: React.RefObject<string>;
}) {
  const arrived = React.useRef(false);
  /** Whether the cells off the window have been taken out of the Tab
      order once already (below). */
  const tabbed = React.useRef(false);
  React.useEffect(() => {
    const el = scrollerRef.current;
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
         word are sections - a photograph on a project page has a hash so
         it can be linked to, and is not somewhere you have arrived. Never
         while the viewer is open: it keeps an entry of its own for the
         back button (`lib/zoom.ts`), and writing over it would leave the
         picture with no way out.

         Also only once the hand has stopped. Written straight from the
         scroll this ran once per section a swipe crossed, and Safari
         meters `replaceState` - a burst of them during a gesture is the
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
         own direct child - no wrapper around it - passed the old test,
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
       when a filter changed - the change simply lands on top of it.

       None of it moves while the strip scrolls. A cell's place against its
       neighbours is fixed by the layout and only changes when the scroller
       does: a resize, a switch between the strip and the rack, a page with
       a different number of cells. So it is measured on those and read from
       here otherwise, and a scroll frame does no layout at all. */
    let centres: number[] = [];
    let widths: number[] = [];
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
      widths = kids.map((c) => c.offsetWidth);
      centres = kids.map((c, i) => leftOf(c) + widths[i] / 2);
      const first = kids[0];
      firstEnd = first ? leftOf(first) + first.offsetWidth * 0.5 : 0;
    };

    /* ── Tab stays on screen ── (`keyboard.ts`) */
    const { benchAll, stop: stopBench } = createBench(el, tabbed, () => ({
      centres,
      widths,
      span,
    }));

    const read = () => {
      queued = 0;
      const x = el.scrollLeft;
      // Where to sit somebody down if they come back to this path.
      seatXRef.current = Math.round(x);
      const kidCount = el.children.length;
      if (centres.length !== kidCount) remeasure();
      benchAll(x);
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
         pictures already at the end - 67% of the rail, measured on
         production on Brand campaigns at 2000. Julian: the scroll bar does
         not reach the end. So in the rack the rail is driven by how far the
         shelf has travelled rather than by what is in the middle, which
         lands the first tick at nought and the last at the end by
         construction.

         And the end lands on the last cell that carries a tick, not on the
         last cell. They are not the same: a sequence can finish on a card
         that leads on or on a page of words, neither of which the rail
         draws, and `at` pointing at one of them lit nothing at all -
         measured, the rail went blank on the final frame of the travel. */
      const lastTick = ticked.length
        ? ticked[ticked.length - 1]
        : kids.length - 1;
      const firstTick = ticked.length ? ticked[0] : 0;
      /* A sequence short enough to fit the window has nowhere to go, and
         `scrollLeft` is nought forever. The end test ran first and `0 >=
         -2` is true, so the rail lit the last of four projects on a
         filter nobody had scrolled - measured on Artist presskit,
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
           on Event coverage: it is showing Brand campaigns. It was - the
           rail was counting projects where it should have been measuring
           the shelf.

           And it lands on the nearest cell the rail can actually draw.
           `best` is the nearest cell of any kind, and a sequence carries
           cells with no tick - a page of words, the ask, the card that
           leads on - which lit nothing at all. */
        const gone = Math.max(0, Math.min(1, x / room));
        /* A paged strip is a screen to a section, so the one in the
           middle of the window is the one you are on. The sliding eye
           read a third of the way in early on the homepage and lit
           Biography with Sessions filling the screen. */
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
          ? [{ i, word: c.dataset.label, name: c.dataset.name, tint: c.dataset.tint }]
          : [],
      );
      const key = t
        .map((x) => `${x.i}:${x.word ?? ""}:${x.name ?? ""}:${x.tint ?? ""}`)
        .join("|");
      if (key === tickKeyRef.current) return;
      tickKeyRef.current = key;
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
      /* The visitor chose a place, so the arrival's aim (`aimed`) is
         spent. Left standing, the next re-lay of the row set the strip
         back on the cell the address named when this effect last ran:
         Julian pressed Inquiries, Sessions, then Biography, and the glide
         to Biography was thrown back toward Sessions a few frames in, the
         bar lighting Sessions. Traced in his Chrome: the end's card
         mounting and leaving re-ran this effect with the address at
         Sessions, and a re-lay during the next glide re-aimed. */
      aimedRef.current = "";
      const hash = decodeURIComponent(window.location.hash.slice(1));
      const i = cellFor(el, hash);
      const where = i >= 0 ? centreOf(el, i) : null;
      if (where !== null) glideRef.current(where);
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
      // As above: the bar reads the address off this event, not the push.
      window.dispatchEvent(new Event(STRIP_SECTION));
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
    /* A link straight to a cell, in the rack. The landing is aimed
       before the rack has placed its frames, at where the cell stands
       in a strip, and the rack then moves it the better part of a
       screen further on. Until the visitor moves the row themselves,
       each re-lay aims again at the cell the address named on
       arrival. */
    /* On arrival only. Read again when the held-back sections
       mounted (`count`), it was the address the strip had since
       written for the section in view, and the next re-lay threw the
       row back to that section's start (Julian's iPad: a swipe
       through Editorial jumped to its title card). */
    if (!arrived.current) {
      arrived.current = true;
      aimedRef.current = decodeURIComponent(window.location.hash.slice(1));
    }
    const handed = () => {
      aimedRef.current = "";
    };
    for (const t of ["wheel", "pointerdown", "keydown", "touchstart"])
      el.addEventListener(t, handed, { once: true, passive: true });
    const again = () => {
      if (aimedRef.current) {
        const i = cellFor(el, aimedRef.current);
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
      stopBench();
    };
  }, [scrollerRef, live, count, paged, atRef, setAt, setTicks, tickKeyRef, setStill, setAim, seatXRef, glideRef, aimedRef]);
}
