import type { Deck } from "@/lib/deck";
import * as React from "react";
import { createBand } from "./band";
import { dragHandlers } from "./drag";
import { createMover } from "./motion";
import { keyHandlers } from "./keyboard";
import { createPaging } from "./paging";
import { wantsLenis, WHEELED } from "./shared";
import { touchHandlers } from "./touch";
import { wheelHandler } from "./wheel";

/**
 * The strip's movement, wired to its scroller: the wheel (`wheel.ts`),
 * a finger (`touch.ts`), a mouse's drag (`drag.ts`), the keys
 * (`keyboard.ts`), the band and the lead-on at the ends (`band.ts`,
 * `lead.ts`) and the landing on a screen (`paging.ts`), all moving the
 * one travel in `motion.ts`. `glide` is handed the travel, for the rail and the
 * address to move the strip with.
 */
export function useMotion({
  scroller: scrollerRef,
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
    const el = scrollerRef.current;
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

    const { onKey, onTab, onFocusIn } = keyHandlers(m);

    const { onSettle, onNote, onStart, reseat, stop: stopPaging } = createPaging(m);
    const { onDown, onMove, onUp, onCancel, onHold, onLet, swallowClick } =
      dragHandlers(m, band, onSettle);
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
      stopPaging();
      resized.disconnect();
      m.wall?.cancel();
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
  }, [scrollerRef, router, nextHref, prevHref, prevStart, live, paged, deck, heldBackRef, glideRef]);
}
