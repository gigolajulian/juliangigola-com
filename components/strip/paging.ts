import * as React from "react";
import type { Mover } from "./motion";
import { centreOf, leftOf } from "./shared";
import type { Tick } from "./use-reader";

/** A paged strip's screens, named for a screen reader. */
export function useSlides({
  scroller: scrollerRef,
  live,
  paged,
  ticks,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  live: boolean;
  paged: boolean;
  ticks: Tick[];
}) {
  /* A paged strip's screens say which they are to a screen reader: a
     group, read as a slide, named with its word and where it stands,
     "Biography, 3 of 7". Written onto the cells here, since a cell is
     often a component of its own; never onto one that is a control or
     already has a role, and a name it already has is kept, with the
     position after it. A free strip says its position once, on the
     `progressbar` under it. */
  React.useEffect(() => {
    const el = scrollerRef.current;
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
  }, [scrollerRef, live, paged, ticks]);
}

/** Where a paged strip comes to rest, and where any strip stays when
    its window changes size. */
export function createPaging(m: Mover) {
  const { el } = m;
  /* A scroll the strip did not start - a sideways trackpad swipe, a
     touch drag, a scrollbar - settles on a section rather than wherever
     it ran out. The wheel and the drag are paged by hand above; this is
     every other way the box can be moved, and without it a page could
     sit with two sections half on screen and nothing to pull it
     straight. It waits for the movement to stop, so it never fights the
     gesture, and it does nothing while the strip is driving itself. */
  let settle = 0;
  /* The screen a paged strip last came to rest on. */
  let seat = m.paged ? m.nearest(el.scrollLeft) : 0;
  const onSettle = () => {
    if (!m.paged || !m.eased) return;
    window.clearTimeout(settle);
    settle = window.setTimeout(() => {
      if (m.down || m.held || m.dragging || m.frame || m.leaving) return;
      /* A wheel's gesture under Lenis is landed by Lenis's own
         `settle`, which starts 140ms after the wheel rests. This one
         fired 20ms later, before Lenis had written a frame, and the
         two pulled two ways: a trackpad swipe of a quarter screen
         slid back to the screen it left and then jumped a whole
         screen on in one frame (Chrome and WebKit, 1440 wide, at
         1.25x, 1.5x and 2x). */
      if (m.smooth && performance.now() - m.gestureAt < 1000) return;
      seat = m.nearest(el.scrollLeft);
      const where = centreOf(el, seat);
      if (where !== null && Math.abs(where - el.scrollLeft) > 2) m.to(where);
    }, 160);
  };
  /* Turned on its side, or the window resized, a paged strip stays on
     the screen it was on: the scroll kept its pixels, which at the new
     width stood two thirds of the way between two screens (an iPad on
     the homepage). A frame on, once the deck has laid its screens out
     again at the new width. */
  /* The site should scale smoothly while the window is dragged. It
     reseated a frame late, so every frame of a drag was painted first at
     the old pixels, between two screens (154 frames in a sweep, up to
     640px off), and then jumped. Here it is put back in the observer,
     after the new layout and before that frame is painted.

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
  // Written only when it changes: a write on every scroll event restyled.
  const onStart = () => {
    const moved = el.scrollLeft >= 8;
    if (moved !== el.hasAttribute("data-moved")) el.toggleAttribute("data-moved", moved);
  };
  onStart();
  const reseat = () => {
    if (el.clientWidth === across && el.clientHeight === tall) return;
    across = el.clientWidth;
    tall = el.clientHeight;
    if (m.paged) {
      const where = centreOf(el, seat);
      if (where !== null) el.scrollLeft = where;
    } else {
      const cell = el.children[anchor.i] as HTMLElement | undefined;
      if (cell) el.scrollLeft = leftOf(cell) - anchor.off;
    }
    m.x = m.target = el.scrollLeft;
  };

  const stop = () => {
    window.clearTimeout(settle);
    window.clearTimeout(noting);
  };
  return { onSettle, onNote, onStart, reseat, stop };
}
