"use client";

import * as React from "react";
import Lenis from "lenis";

export function SmoothScroll() {
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

    // Sync Lenis with window scroll on navigation / dynamic content changes
    const onResize = () => lenis.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      lenis.destroy();
    };
  }, []);

  return null;
}
