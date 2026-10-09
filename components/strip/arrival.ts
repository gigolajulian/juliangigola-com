import * as React from "react";
import { flyCovers } from "@/lib/work-view";
import {
  cellFor,
  centreOf,
  DEAL_MS,
  FILTER_MS,
  nav,
  POP_MS,
  seat,
} from "./shared";

/** Where a strip opens, and how it comes in: on a deep link's cell, at
    the end walking back, at its seat coming back, or dealt in. */
export function useArrival({
  scroller: scrollerRef,
  live,
  arrive,
  seatX: seatXRef,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  live: boolean;
  arrive?: "none";
  seatX: React.RefObject<number>;
}) {
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
    const el = scrollerRef.current;
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
       in. No animation with it - coming back to where you were is not an
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
        seatXRef.current = seated;
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
         with - which since the ask came off the discipline pages is the
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
  }, [scrollerRef, live, arrive, seatXRef]);
}

/** The order the cells rise in as the strip arrives. */
export function useArrivalOrder(scrollerRef: React.RefObject<HTMLDivElement | null>) {
  /* The photographs arrive from the middle of the window out, the
     nearest first. After the effect above has put the strip where it
     opens, so the middle is the one the visitor sees. Not on the
     portfolio and its disciplines, which keep reading left to right;
     Motion is a page of films and takes it. */
  React.useLayoutEffect(() => {
    const el = scrollerRef.current;
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
  }, [scrollerRef]);
}

/** Keeps the seat the strip is left in, under its path. */
export function useSeatKeeper({
  scroller: scrollerRef,
  live,
  seatX: seatXRef,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  live: boolean;
  seatX: React.RefObject<number>;
}) {
  /* Where this strip was when the page left, kept under the path it was
     on. The path is read when the effect is set up, not in the cleanup:
     by the time React tears a page down the address bar is already
     showing the next one. */
  React.useEffect(() => {
    if (!scrollerRef.current || !live) return;
    const path = window.location.pathname;
    // The live position (`seatX`), read when the strip goes.
    const kept = seatXRef;
    return () => {
      /* From the ref and not from the element: by the time a cleanup runs,
         React has taken the scroller out of the document, and a detached
         box reads `scrollLeft` 0 - which is how the first version of this
         faithfully remembered the beginning of every sequence. */
      try {
        window.sessionStorage.setItem(seat(path), String(kept.current));
      } catch {
        // Private browsing. The seat is a courtesy, not a feature.
      }
    };
  }, [scrollerRef, live, seatXRef]);
}
