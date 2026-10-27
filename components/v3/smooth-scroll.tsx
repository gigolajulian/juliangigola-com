"use client";

import * as React from "react";
import Lenis from "lenis";
import { usePathname } from "next/navigation";

/* The live instance, for code that needs where a glide will end (chrome.tsx). */
export const lenisNow: { current: Lenis | null } = { current: null };

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
    lenisNow.current = lenis;

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
      lenisNow.current = null;
    };
  }, []);

  // Re-measure on every route change too, in case the new page has the
  // same body height at first and only grows later.
  React.useEffect(() => {
    lenisRef.current?.resize();
  }, [pathname]);

  return null;
}
