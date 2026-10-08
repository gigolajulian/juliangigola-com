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
 * as on basis, his reference; the orbit he tried after them is gone.
 *
 * On a phone or an iPad there is no pointer and the space holds still.
 * It followed the device's tilt there, until Julian took the gyroscope
 * off the homepage (2026-09-29).
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
     fast it follows: the "3D tilt" panel. */
  const space = useLatest(useSpace());
  React.useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
        (1 - space.current.followSpeed / 100) **
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
    /* Where the space turns to, from -1 to 1 on each axis. */
    const aim = (x: number, y: number) => {
      // Not while another screen of the deck lies over it (`lib/deck.ts`).
      if (el.closest("[data-buried]")) return;
      const c = (v: number) => Math.max(-1, Math.min(1, v));
      tx = c(x) * space.current.tiltSideways;
      ty = c(y) * space.current.tiltUpDown;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const move = (e: PointerEvent) => {
        /* Julian: the space holds still while he works the DialKit panel. */
        if ((e.target as Element | null)?.closest?.('[class*="dialkit"]')) return;
        aim(
          (e.clientX / innerWidth - 0.5) * 2,
          (0.5 - e.clientY / innerHeight) * 2,
        );
      };
      addEventListener("pointermove", move, { passive: true });
      return () => {
        removeEventListener("pointermove", move);
        cancelAnimationFrame(raf);
      };
    }

    /* Preview (`?tilt=1`), Julian: the hero is too still on a phone and an
       iPad. The space turns after a finger on the cover the way it turns
       after a pointer, and eases back when it lifts. Touch events rather
       than pointer ones: a pointer is cancelled the moment the page starts
       to scroll, and a touch keeps reporting while it does, so the tilt
       goes on following the finger through a scroll. Passive, so the
       scroll itself is never held. */
    if (!/[?&]tilt=1/.test(location.search)) return;
    const cover = el.closest("section") ?? el.parentElement;
    if (!cover) return;
    const touch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) aim((t.clientX / innerWidth - 0.5) * 2, (0.5 - t.clientY / innerHeight) * 2);
    };
    const lift = (e: TouchEvent) => {
      if (!e.touches.length) aim(0, 0);
    };
    cover.addEventListener("touchstart", touch, { passive: true });
    cover.addEventListener("touchmove", touch, { passive: true });
    cover.addEventListener("touchend", lift, { passive: true });
    cover.addEventListener("touchcancel", lift, { passive: true });
    return () => {
      cover.removeEventListener("touchstart", touch);
      cover.removeEventListener("touchmove", touch);
      cover.removeEventListener("touchend", lift);
      cover.removeEventListener("touchcancel", lift);
      cancelAnimationFrame(raf);
    };
  }, [space]);

  return (
    <div ref={ref} aria-hidden className={className}>
      {children}
    </div>
  );
}
