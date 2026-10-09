import * as React from "react";
import { preload } from "react-dom";
import type { Lead } from "@/components/strip";
import { leftOf } from "./shared";

/** The pages either end leads to, fetched before the push that leads
    there. */
export function usePrefetch({
  scroller: scrollerRef,
  live,
  router,
  nextHref,
  nextWarm,
  prevHref,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  live: boolean;
  router: { prefetch: (href: string) => void };
  nextHref?: string;
  nextWarm?: Lead["warm"];
  prevHref?: string;
}) {
  /* Julian: a delay between the scroll and the page switching. The page
     led on to was fetched only once the strip left, so the deal waited on
     the network. Each end's page is fetched once the strip is within a
     screen and a half of it, one request a way, well before the push. */
  React.useEffect(() => {
    const el = scrollerRef.current;
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
  }, [scrollerRef, router, nextHref, nextWarm, prevHref, live]);
}

/** The photographs either side of where the strip rests, fetched and
    decoded before a swipe brings them in. */
export function useWarmAhead(
  scrollerRef: React.RefObject<HTMLDivElement | null>,
  live: boolean,
  count: number,
) {
  /* The photographs a swipe is about to bring in, ready before it does.
     A picture that comes on screen undecoded is decoded in the frame that
     shows it, and a swipe that brought in a dozen did a dozen in a row: the
     bumps in an otherwise smooth swipe on the portfolio. Once the strip has
     rested, and when the page is idle, the next two screens' pictures are
     fetched and decoded either side of where it stands. */
  React.useEffect(() => {
    const el = scrollerRef.current;
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
  }, [scrollerRef, live, count]);
}

/** The cells more than a screen off the window, hidden until the page
    has landed. */
export function useFarCells(
  scrollerRef: React.RefObject<HTMLDivElement | null>,
  live: boolean,
  paged: boolean,
) {
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
    const el = scrollerRef.current;
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
  }, [scrollerRef, live, paged]);
}
