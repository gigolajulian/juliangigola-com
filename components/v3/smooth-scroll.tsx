"use client";

import * as React from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";

type ScrollFn = (y: number) => void;
const scrollFns = new Set<ScrollFn>();
let live: Lenis | null = null;

/** Jumps to the top, through Lenis when it runs: a plain scrollTo mid-glide
 *  is written over by Lenis's next frame (page-fly.tsx). */
export function scrollTop() {
  if (live) live.scrollTo(0, { immediate: true, force: true });
  else scrollTo(0, 0);
}

/** Moves the page by `dy` without breaking a glide: Lenis writes its own
 *  position every frame, so a plain scrollBy is undone (home.tsx rows). */
export function shiftScroll(dy: number) {
  if (live) {
    // shortcut: shifts Lenis's internal glide (from/to/value, lenis 1.3), recheck on a Lenis upgrade
    const glide = (live as unknown as { animate?: { from: number; to: number; value: number } }).animate;
    if (glide) {
      glide.from += dy;
      glide.to += dy;
      glide.value += dy;
    }
    live.animatedScroll += dy;
    live.targetScroll += dy;
  }
  scrollBy(0, dy);
}

/** Called inside Lenis's own frame, right after it moves the page, with the
 *  page scroll it just wrote. Native scroll events only arrive a frame later. */
export function onLenisScroll(fn: ScrollFn) {
  scrollFns.add(fn);
  return () => void scrollFns.delete(fn);
}

export function SmoothScroll() {
  const pathname = usePathname();
  const lenisRef = React.useRef<Lenis | null>(null);

  React.useEffect(() => {
    // Skip if reduced motion is requested
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // A lerp follows the wheel as it moves instead of replaying a fixed
    // 1.2s glide on every event, which read as lag on a trackpad (2026-10-30).
    const lenis = new Lenis({
      lerp: 0.2,
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
      autoRaf: true,
    });
    lenisRef.current = live = lenis;
    lenis.on("scroll", () => scrollFns.forEach((fn) => fn(window.scrollY)));

    // Sync Lenis with window scroll on navigation / dynamic content changes
    const onResize = () => lenis.resize();
    window.addEventListener("resize", onResize);

    // <html> is h-full, so Lenis's own observer never sees the page grow
    // after a client route change. The body does grow, so watch that.
    const resizeObserver = new ResizeObserver(() => lenis.resize());
    resizeObserver.observe(document.body);

    return () => {
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      lenis.destroy();
      lenisRef.current = live = null;
    };
  }, []);

  // Re-measure on every route change too, in case the new page has the
  // same body height at first and only grows later.
  React.useEffect(() => {
    lenisRef.current?.resize();
  }, [pathname]);

  return null;
}
