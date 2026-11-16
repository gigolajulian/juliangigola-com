"use client";

import * as React from "react";
import { v4pages } from "@/lib/v4pages";

/** `?v4pages=p3`, the /portfolio grid's scroll motion (app/styles/v4pages.css).
    1. Marks the tiles within half a screen of the viewport (`data-v4d`): only
       those animate, since each moving tile is a compositor layer.
    2. Lag: while the page scrolls, the marked tiles trail it by their column's
       share of the eased scroll speed, written as `translate` on those tiles
       alone (a variable on the grid restyled all 135 tiles a frame: 50 ms p95).
       At rest the style is removed and the grid is the plain grid. Project
       covers only: a gallery's wide frames break the column count.
    `k` changes when the grid's tiles do. */
const LAG = [0, 0.55, 1, 0.3, 0.8, 0.15]; // per column, of 64px at full speed

export function V4Drift({ k }: { k: string }) {
  React.useEffect(() => {
    if (!v4pages("p3") || !CSS.supports("animation-timeline: view()") || !matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    const grid = document.querySelector<HTMLElement>("#p-work .wgrid");
    if (!grid) return;
    const tiles = [...grid.querySelectorAll<HTMLElement>(".wt")];
    const near = new Set<HTMLElement>();
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          const t = e.target as HTMLElement;
          t.toggleAttribute("data-v4d", e.isIntersecting);
          if (e.isIntersecting) near.add(t);
          else (near.delete(t), t.style.removeProperty("translate"));
        }),
      { rootMargin: "50% 0px" }
    );
    tiles.forEach((t) => io.observe(t));
    if (grid.classList.contains("wframes")) return () => io.disconnect();

    const col = new Map(tiles.map((t, i) => [t, i]));
    let v = 0, y = scrollY, t = 0, raf = 0, cols = 4;
    const tick = (now: number) => {
      const dt = Math.min(50, Math.max(1, now - t));
      t = now;
      // 3 px a ms (a hard flick) is the full lag; a steady wheel sits near a third of it
      const raw = Math.max(-1, Math.min(1, (scrollY - y) / dt / 3));
      y = scrollY;
      v += (raw - v) * (1 - Math.exp(-dt / 150));
      const rest = raw === 0 && Math.abs(v) < 0.003;
      for (const el of near) {
        const k = LAG[col.get(el)! % cols];
        if (rest || !k) el.style.removeProperty("translate");
        else el.style.translate = `0 ${(v * k * 64).toFixed(1)}px`;
      }
      raf = rest ? 0 : requestAnimationFrame(tick);
    };
    const move = () => {
      if (raf) return;
      t = performance.now();
      y = scrollY;
      cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      raf = requestAnimationFrame(tick);
    };
    addEventListener("scroll", move, { passive: true });
    return () => {
      io.disconnect();
      removeEventListener("scroll", move);
      cancelAnimationFrame(raf);
      tiles.forEach((el) => el.style.removeProperty("translate"));
    };
  }, [k]);
  return null;
}
