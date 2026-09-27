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
 * On a phone or an iPad there is no pointer, so the space follows the
 * device's tilt instead (Julian's pick over a finger drag or a drift).
 * iOS only hands out the orientation after asking, and only asks from a
 * tap, so there it starts at the visitor's first touch of the page.
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

    /* The tilt. 25 degrees either way is the full turn. Forward and back
       is measured from however the device is being held, and that rest
       point follows slowly, so lying on a sofa is as level as sitting up. */
    if (typeof DeviceOrientationEvent === "undefined") return;
    const TILT = 25;
    let rest: number | null = null;
    const orient = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      const angle = screen.orientation?.angle ?? 0;
      const [side, fore] =
        angle === 90
          ? [e.beta, -e.gamma]
          : angle === 270 || angle === -90
            ? [-e.beta, e.gamma]
            : angle === 180
              ? [-e.gamma, -e.beta]
              : [e.gamma, e.beta];
      rest = rest === null ? fore : rest + (fore - rest) * 0.01;
      aim(side / TILT, (fore - rest) / TILT);
    };
    const listen = () =>
      addEventListener("deviceorientation", orient, { passive: true });
    const ios = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };
    const ask = () =>
      ios.requestPermission?.()
        .then((state) => state === "granted" && listen())
        .catch(() => {});
    if (typeof ios.requestPermission === "function") {
      addEventListener("click", ask, { once: true });
    } else {
      listen();
    }
    return () => {
      removeEventListener("click", ask);
      removeEventListener("deviceorientation", orient);
      cancelAnimationFrame(raf);
    };
  }, [space]);
  return (
    <div ref={ref} aria-hidden className={className}>
      {children}
    </div>
  );
}
