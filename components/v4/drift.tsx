"use client";

import * as React from "react";
import { v4pages } from "@/lib/v4pages";
import { frameDt, springSettled, stepSpring } from "@/lib/motion/spring";

/** `?v4pages=p3`, the /portfolio grid's scroll motion (app/styles/v4pages.css).
    1. Marks the tiles within half a screen of the viewport (`data-v4d`): only
       those animate, since each moving tile is a compositor layer.
    2. Lag: while the page scrolls, the marked tiles trail it by their column's
       share of a critically damped spring (lib/motion/spring.ts) that chases
       the scroll speed. A spring carries its own speed through a reversal, so
       changing direction bends instead of kinking; the speed is rubber-banded,
       so a hard flick leans further without ever hitting a stop. Written as
       `translate` on the near tiles alone (a variable on the grid restyled all
       135 tiles a frame: 50 ms p95). At rest the style is removed and the grid
       is the plain grid. Project covers only: a gallery's wide frames break
       the column count. If frames run long while it moves, the lag and the
       drift switch themselves off for the page: a still grid beats a dragging one.
    `k` changes when the grid's tiles do. */
const LAG = [0, 0.55, 1, 0.3, 0.8, 0.15]; // each column's share
const GAIN = 30; // px of lag per px/ms of scroll, before the band
const BAND = 110; // px the lag approaches and never reaches
const band = (x: number) => (x * BAND) / (BAND + Math.abs(x));

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
    // a gallery keeps the loop for `data-v4lag` and the long-frame watch, without the lag
    const lagOn = !grid.classList.contains("wframes");

    const col = new Map(tiles.map((t, i) => [t, i]));
    let s = { x: 0, v: 0 }, y = scrollY, at = 0, raf = 0, cols = 4, long = 0;
    const clear = () => tiles.forEach((el) => el.style.removeProperty("translate"));
    const tick = (now: number) => {
      const dt = frameDt(now, at);
      // a frame over 30 ms counts against the lag, a good one forgives a little
      long = at && now - at > 30 ? long + 1 : Math.max(0, long - 0.25);
      at = now;
      // too many long frames: the lag eases home, then all of it stays off for the page
      const off = long > 12;
      const target = off ? 0 : band(((scrollY - y) / (dt * 1000)) * GAIN);
      y = scrollY;
      s = stepSpring(s, target, 1, dt);
      const rest = target === 0 && springSettled(s, 0);
      if (rest) {
        raf = 0;
        clear();
        grid.removeAttribute("data-v4lag");
        if (off) {
          // the drift goes too: together they cost a throttled CPU half its frames
          removeEventListener("scroll", move);
          io.disconnect();
          tiles.forEach((el) => el.removeAttribute("data-v4d"));
        }
        return;
      }
      for (const el of near) {
        const k = LAG[col.get(el)! % cols];
        if (lagOn && k) el.style.translate = `0 ${(s.x * k).toFixed(2)}px`;
      }
      raf = requestAnimationFrame(tick);
    };
    const move = () => {
      if (raf) return;
      at = 0;
      y = scrollY;
      s = { x: 0, v: 0 };
      cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
      grid.setAttribute("data-v4lag", ""); // while the page moves: layers for the lagging tiles, no hover zoom
      raf = requestAnimationFrame(tick);
    };
    addEventListener("scroll", move, { passive: true });
    return () => {
      io.disconnect();
      removeEventListener("scroll", move);
      cancelAnimationFrame(raf);
      clear();
      grid.removeAttribute("data-v4lag");
    };
  }, [k]);
  return null;
}
