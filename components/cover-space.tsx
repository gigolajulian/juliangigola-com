"use client";

import * as React from "react";
import { useLatest, useSpace } from "@/components/hero-dials";
import { matches } from "@/lib/device";

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
 * off the homepage.
 * Now the photographs and the words drift with the scroll there.
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

    if (matches("fine")) {
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
    /* Julian: on a phone and an iPad the
       photographs drift apart as the page scrolls, the near ones (`--fz`)
       faster than the far, so the depth they hang at shows. Written in
       the scroll handler, each frame's `translate` only. */
    if (!/[?&]tilt=1/.test(location.search)) {
      let box: HTMLElement | null = el.parentElement;
      // The window on a phone; the deck, which runs sideways, on an iPad.
      while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY + getComputedStyle(box).overflowX)) box = box.parentElement;
      const side = !!box && box.scrollWidth > box.clientWidth;
      const frames = [...el.querySelectorAll<HTMLElement>(".cover-float-frame")].map((f) => ({
        f,
        // z runs about -50 to 150: 0.15 to 0.5 of the scroll.
        rate: 0.15 + Math.max(0, Math.min(1, (parseFloat(getComputedStyle(f).getPropertyValue("--fz")) + 50) / 200)) * 0.35,
      }));
      /* Julian: the name, the role, the line under it and the buttons
         too, each a little more than the one above, all slower than the
         photographs. Their own `translate`: the rise in is a `transform`. */
      const words = [...(el.closest("section")?.querySelectorAll<HTMLElement>(".cover-float-middle .lift") ?? [])].map(
        (f, i) => ({ f, rate: 0.04 + i * 0.03 }),
      );
      const scroll = () => {
        const span = side ? innerWidth : innerHeight;
        const top = Math.min(box ? (side ? box.scrollLeft : box.scrollTop) : scrollY, span);
        for (const { f, rate } of frames) {
          const d = `${(-top * rate).toFixed(1)}px`;
          /* Julian: and back into the space, not too far. A screen's
             scroll sends them 1200px to 2400px back, the near ones
             furthest (about 0.7 to 0.6 of their size at the cover's
             3280px perspective). */
          const z = `${((-top / span) * (1200 + ((rate - 0.15) / 0.35) * 1200)).toFixed(1)}px`;
          // Julian: down, scrolling up and down; the page lifts past them.
          f.style.translate = side ? `${d} 0 ${z}` : `0 ${(top * rate).toFixed(1)}px ${z}`;
          /* Julian: faded out as they sink, so none lies over the name;
             gone by half a screen. On the card: opacity on the frame
             would flatten its depth. */
          const card = f.firstElementChild as HTMLElement | null;
          if (card) card.style.opacity = top ? String(Math.max(0, 1 - top / (span * 0.5))) : "";
        }
        for (const { f, rate } of words) {
          const d = (side ? -top : top) * rate;
          f.style.translate = side ? `${d.toFixed(1)}px 0` : `0 ${d.toFixed(1)}px`;
        }
      };
      const target: HTMLElement | Window = box ?? window;
      target.addEventListener("scroll", scroll, { passive: true });
      scroll();
      return () => target.removeEventListener("scroll", scroll);
    }
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
