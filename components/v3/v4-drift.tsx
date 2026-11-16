"use client";

import * as React from "react";
import { v4pages } from "@/lib/v4pages";

/** `?v4pages=p3`: marks the /portfolio grid tiles within half a screen of the
    viewport (`data-v4d`), so only those carry the drift animation and its
    compositor layer (app/styles/v4pages.css). All 135 animated at once cost
    128 layers; this holds it near 40. `k` changes when the grid's tiles do. */
export function V4Drift({ k }: { k: string }) {
  React.useEffect(() => {
    if (!v4pages("p3") || !CSS.supports("animation-timeline: view()") || !matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => (e.target as HTMLElement).toggleAttribute("data-v4d", e.isIntersecting)), { rootMargin: "50% 0px" });
    document.querySelectorAll("#p-work .wgrid .wt").forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [k]);
  return null;
}
