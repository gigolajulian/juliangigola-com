"use client";

import * as React from "react";

/** Strip view: from 768px up, wheel and finger move the row, with iOS-style momentum on lift. */
export function useStripScroll(
  view: string,
  cells: unknown,
  stripRef: React.RefObject<HTMLDivElement | null>,
  stripBar: () => void,
) {
  React.useEffect(() => {
    if (view !== "strip") return;
    const s = stripRef.current!;
    s.scrollLeft = 0;
    requestAnimationFrame(stripBar);
    /* From 768px up a vertical scroll (wheel, trackpad or finger) moves the
       row and the page stays still; below it, a native swipe with snap. */
    const wide = matchMedia("(min-width: 768px)");
    const wheel = (e: WheelEvent) => {
      if (!wide.matches || e.ctrlKey) return; // Ctrl+wheel and pinch are zoom (WCAG 1.4.4)
      e.preventDefault();
      s.scrollLeft +=
        Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    };
    /* A finger from 768px up moves the row one to one, so on lift it has
       to carry on the way iOS's own scroll does: the speed of the last
       tenth of a second, run down at iOS's normal rate (0.998 a ms).
       Without it a flick stops dead on lift. A finger back on
       the glass catches it. */
    let ty: [number, number] | null = null;
    let moves: { t: number; d: number }[] = [];
    let glide = 0;
    // A tap that stopped a glide only stops it, as on iOS: no cover opens.
    let caught = false;
    const halt = () => {
      cancelAnimationFrame(glide);
      glide = 0;
    };
    const start = (e: TouchEvent) => {
      caught = glide !== 0;
      halt();
      moves = [];
      ty = [e.touches[0].clientX, e.touches[0].clientY];
    };
    const click = (e: MouseEvent) => {
      if (!caught) return;
      caught = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const move = (e: TouchEvent) => {
      if (!wide.matches || !ty) return;
      e.preventDefault();
      const t = e.touches[0],
        dx = ty[0] - t.clientX,
        dy = ty[1] - t.clientY;
      ty = [t.clientX, t.clientY];
      const d = Math.abs(dy) > Math.abs(dx) ? dy : dx;
      s.scrollLeft += d;
      moves.push({ t: e.timeStamp, d });
      moves = moves.filter((m) => e.timeStamp - m.t <= 100);
    };
    const end = (e: TouchEvent) => {
      ty = null;
      // A swipe that began on a glide is not a tap; let the next click through.
      if (moves.length > 1) caught = false;
      if (!wide.matches || e.touches.length || moves.length < 2) return;
      const last = moves[moves.length - 1];
      // Held still before lifting: no throw.
      if (e.timeStamp - last.t > 80) return;
      const span = Math.max(16, last.t - moves[0].t);
      let v = moves.slice(1).reduce((a, m) => a + m.d, 0) / span;
      v = Math.max(-6, Math.min(6, v));
      if (Math.abs(v) < 0.2) return;
      let at = 0;
      const step = (now: number) => {
        const dt = at ? Math.min(32, now - at) : 16;
        at = now;
        const before = s.scrollLeft;
        s.scrollLeft += v * dt;
        v *= Math.pow(0.998, dt);
        // Run out, or stopped by an end.
        if (Math.abs(v) < 0.02 || s.scrollLeft === before) {
          glide = 0;
          return;
        }
        glide = requestAnimationFrame(step);
      };
      glide = requestAnimationFrame(step);
    };
    addEventListener("wheel", wheel, { passive: false });
    s.addEventListener("touchstart", start, { passive: true });
    s.addEventListener("touchmove", move, { passive: false });
    s.addEventListener("touchend", end, { passive: true });
    s.addEventListener("touchcancel", halt, { passive: true });
    s.addEventListener("click", click, true);
    return () => {
      halt();
      removeEventListener("wheel", wheel);
      s.removeEventListener("touchstart", start);
      s.removeEventListener("touchmove", move);
      s.removeEventListener("touchend", end);
      s.removeEventListener("touchcancel", halt);
      s.removeEventListener("click", click, true);
    };
    // stripRef is a ref passed in: stable, so it stays out of the list as it did inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, cells, stripBar]);
}
