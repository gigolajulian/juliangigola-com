import * as React from "react";
import { STRIP_SECTION } from "@/lib/utils";
import { cellFor } from "./shared";

/**
 * A strip stacked down a phone: the page's own scroll says when the
 * opening cell has gone, and a link to a cell scrolls the page to it.
 */
export function useStacked(
  scrollerRef: React.RefObject<HTMLDivElement | null>,
  live: boolean,
) {
  /* Past the opening cell, stacked down a phone as well: the page's own
     scroll, half the cell gone off the top, as `data-past-first` says it
     sideways (`read` below). Its own name, so only the navbar's wordmark
     reads it, not the running heads of the stacked pages (Julian,
     2026-10-04: the name in the bar on an iPhone once the hero is passed). */
  React.useEffect(() => {
    const el = scrollerRef.current;
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
  }, [scrollerRef, live]);

  /* Stacked down a phone the strip is not live: none of its scrolling runs,
     and the cells are no more than sections of a page that scrolls. Its
     jumps went with it. Cells carry `data-hash`, not an id, so the browser
     could not find them either, and every link to a screen (the cover's
     Book a session, the menu's About, /sessions redirecting to
     /#sessions) changed the address and left a phone at the top. Here the
     page is scrolled to the cell instead: on arrival, on a hash change, and
     on a link to this page, which Next moves without a hashchange. */
  React.useEffect(() => {
    const el = scrollerRef.current;
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
  }, [scrollerRef, live]);
}
