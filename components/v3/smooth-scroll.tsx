"use client";

import * as React from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";

type ScrollFn = (y: number) => void;
const scrollFns = new Set<ScrollFn>();

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

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.5,
      autoRaf: true,
    });
    lenisRef.current = lenis;
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
      lenisRef.current = null;
    };
  }, []);

  // Re-measure on every route change too, in case the new page has the
  // same body height at first and only grows later.
  React.useEffect(() => {
    lenisRef.current?.resize();
  }, [pathname]);

  return null;
}
