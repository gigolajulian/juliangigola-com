"use client";

import * as React from "react";
import { useLatest, useSpace } from "@/components/hero-dials";

/**
 * The space the cover's frames hang in.
 *
 * Julian: in 3D space and not tied to each other. The frames hang at
 * different depths (`--z` on each, `cover-float.tsx`), and the space turns
 * a few degrees after the pointer, easing rather than jumping, so near and
 * far frames move apart. Once they have landed they stay where they are,
 * as on basis, his reference; the orbit he tried after them is gone. A
 * mouse only; a finger has nothing to follow.
 */
export function CoverSpace({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  /* How far the space turns at the screen's edge, in degrees, and how
     fast it follows: the "Hero space" panel. */
  const space = useLatest(useSpace());
  React.useEffect(() => {
    const el = ref.current;
    if (
      !el ||
      !matchMedia("(hover: hover) and (pointer: fine)").matches ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      /* The same glide at 60Hz and 120Hz: `follow` percent of the way
         (Julian: 23) per 60th of a second, however many frames that is. */
      const k =
        1 -
        (1 - space.current.follow / 100) **
          (Math.min(now - (last || now - 16.7), 100) / 16.7);
      last = now;
      x += (tx - x) * k;
      y += (ty - y) * k;
      el.style.transform = `rotateX(${y.toFixed(3)}deg) rotateY(${x.toFixed(3)}deg)`;
      raf =
        Math.abs(tx - x) + Math.abs(ty - y) > 0.05
          ? requestAnimationFrame(tick)
          : (last = 0);
    };
    const move = (e: PointerEvent) => {
      tx = (e.clientX / innerWidth - 0.5) * 2 * space.current.turnY;
      ty = (0.5 - e.clientY / innerHeight) * 2 * space.current.turnX;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    addEventListener("pointermove", move, { passive: true });
    return () => {
      removeEventListener("pointermove", move);
      cancelAnimationFrame(raf);
    };
  }, [space]);
  return (
    <div ref={ref} aria-hidden className={className}>
      {children}
    </div>
  );
}
