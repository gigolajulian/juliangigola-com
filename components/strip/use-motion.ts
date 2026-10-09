import type { Deck } from "@/lib/deck";
import * as React from "react";
import { createBand } from "./band";
import { dragHandlers } from "./drag";
import { createMover } from "./motion";
import { centreOf, leftOf, wantsLenis, WHEELED } from "./shared";
import { touchHandlers } from "./touch";
import { wheelHandler } from "./wheel";

/**
 * The strip's movement, wired to its scroller: the wheel (`wheel.ts`),
 * a finger (`touch.ts`), a mouse's drag (`drag.ts`), the band and the
 * lead-on at the ends (`band.ts`, `lead.ts`), all moving the one travel
 * in `motion.ts`. `glide` is handed the travel, for the rail and the
 * address to move the strip with.
 */
export function useMotion({
  scroller,
  live,
  paged,
  deck,
  nextHref,
  prevHref,
  prevStart,
  router,
  heldBack: heldBackRef,
  glide: glideRef,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  live: boolean;
  paged: boolean;
  deck?: Deck;
  nextHref?: string;
  prevHref?: string;
  prevStart: boolean;
  router: { push: (href: string) => void };
  heldBack: React.RefObject<boolean>;
  glide: React.RefObject<(to: number) => void>;
}) {
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
    const m = createMover(el, {
      paged,
      eased,
      smooth,
      nextHref,
      prevHref,
      prevStart,
      deck,
      heldBack: heldBackRef,
      go: (href) => router.push(href),
    });

    /* ── the scroller's own measurements, taken when it changes ──
       `scrollWidth` and `clientWidth` both make the browser lay the page
       out before they can answer, and the loop writes `scrollLeft`
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
    const firstSize = requestAnimationFrame(() => {
      m.size();
      m.x = m.target = el.scrollLeft;
    });

    const band = createBand(m);
    glideRef.current = m.to;

    const { onMoved, onTouchStart, onTouchMove, onTouchEnd } = touchHandlers(m, band);
    const onWheel = wheelHandler(m, band);

    /* The keyboard, on the scroller or anything in it that does not want
       the keys for itself: the arrows and Page Up and Page Down move a
       screen, Home and End go to the ends. A paged strip's screen is its
       next cell; a free one moves by the window's width. A key pressed in
       a field, or in a box that scrolls on its own, is that one's. It
       listened on the scroller alone, so with a cover or a link inside it
       focused the arrows did nothing (2026-10-09). */
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      const from = e.target as HTMLElement | null;
      if (!from || !el.contains(from)) return;
      if (
        from !== el &&
        from.closest(
          'input, textarea, select, [contenteditable="true"], [role="slider"], [role="radiogroup"], [role="radio"], [role="listbox"], [role="menu"], dialog[open]',
        )
      )
        return;
      const page = e.key === "PageDown" || e.key === "PageUp";
      // Page Up and Page Down scroll a box of words in their own way.
      if (page && from !== el && from.closest("[data-scroll]")) return;
      const step =
        e.key === "ArrowRight" || e.key === "PageDown"
          ? 1
          : e.key === "ArrowLeft" || e.key === "PageUp"
            ? -1
            : 0;
      if (!step && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      // The strip may have grown since it was last measured (`defer`).
      m.size();
      const last = el.children.length - 1;
      let where: number | null;
      if (e.key === "Home") where = 0;
      // The end itself: the last cell is often narrower than half a
      // window, so its centre is short of the end.
      else if (e.key === "End") where = m.room();
      else if (paged) {
        /* Where the strip is going, not where it is: three quick presses
           should step three screens, and each one read the cell in the
           middle of the window while the glide from the press before it
           was still on its way there. */
        const i = Math.max(0, Math.min(last, m.nearest(m.target) + step));
        where = i === 0 ? 0 : i === last ? m.room() : centreOf(el, i);
      } else where = m.target + step * m.width;
      if (where === null) return;
      m.to(where);
      /* Focus does not stay behind on a screen that is leaving: it goes
         back to the strip, which says where it now is. */
      if (from !== el) el.focus({ preventScroll: true });
    };

    /* A scroll the strip did not start - a sideways trackpad swipe, a
       touch drag, a scrollbar - settles on a section rather than wherever
       it ran out. The wheel and the drag are paged by hand above; this is
       every other way the box can be moved, and without it a page could
       sit with two sections half on screen and nothing to pull it
       straight. It waits for the movement to stop, so it never fights the
       gesture, and it does nothing while the strip is driving itself. */
    let settle = 0;
    /* The screen a paged strip last came to rest on. */
    let seat = paged ? m.nearest(el.scrollLeft) : 0;
    const onSettle = () => {
      if (!paged || !eased) return;
      window.clearTimeout(settle);
      settle = window.setTimeout(() => {
        if (m.down || m.held || m.dragging || m.frame || m.leaving) return;
        /* A wheel's gesture under Lenis is landed by Lenis's own `settle`,
           which starts 140ms after the wheel rests. This one fired 20ms
           later, before Lenis had written a frame, and the two pulled two
           ways: a trackpad swipe of a quarter screen slid back to the
           screen it left and then jumped a whole screen on in one frame
           (Chrome and WebKit, 1440 wide, at 1.25x, 1.5x and 2x,
           2026-10-09). */
        if (smooth && performance.now() - m.gestureAt < 1000) return;
        seat = m.nearest(el.scrollLeft);
        const where = centreOf(el, seat);
        if (where !== null && Math.abs(where - el.scrollLeft) > 2) m.to(where);
      }, 160);
    };
    const { onDown, onMove, onUp, onCancel, onHold, onLet, swallowClick } =
      dragHandlers(m, band, onSettle);
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
      if (paged) {
        const where = centreOf(el, seat);
        if (where !== null) el.scrollLeft = where;
      } else {
        const cell = el.children[anchor.i] as HTMLElement | undefined;
        if (cell) el.scrollLeft = leftOf(cell) - anchor.off;
      }
      m.x = m.target = el.scrollLeft;
    };


    /* Tab into a section that is off screen and the browser jumps the box
       to it: instantly, and to wherever it takes to get the element in
       view, which on a paged page is usually between two sections. So the
       jump is put back and the strip travels there itself. Only for the
       keyboard - a press focuses what it presses, and recentring under a
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
      if (Math.abs(where - el.scrollLeft) > 2) m.to(where);
    };

    /* The way back to the top of a page that has no top. The wordmark in
       the header is that way on every other page; here it dispatches this
       at the scroller instead of scrolling a document that never moves,
       and the strip travels home under the same friction as a wheel
       notch rather than cutting there. */
    const onHome = () => m.to(0);

    // And whenever the scroller changes shape: a window resized, the rack
    // swapped for the strip, a cell arriving.
    const resized = new ResizeObserver(() => {
      m.size();
      reseat();
    });
    resized.observe(el);

    el.addEventListener("jg:home", onHome);
    el.addEventListener("scroll", onSettle, { passive: true });
    el.addEventListener("scroll", onMoved, { passive: true });
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
      if (!m.down && !m.frame) m.target = el.scrollLeft;
    };
    el.addEventListener("scroll", sync, { passive: true });

    return () => {
      cancelAnimationFrame(firstSize);
      window.clearTimeout(settle);
      resized.disconnect();
      m.wall?.cancel();
      window.clearTimeout(noting);
      el.removeEventListener("jg:home", onHome);
      el.removeEventListener("scroll", onSettle);
      el.removeEventListener("scroll", onMoved);
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
      if (m.frame) cancelAnimationFrame(m.frame);
      if (m.band) cancelAnimationFrame(m.band);
      el.style.translate = "";
      delete el.dataset.release;
    };
  }, [scroller, router, nextHref, prevHref, prevStart, live, paged, deck, heldBackRef, glideRef]);
}
