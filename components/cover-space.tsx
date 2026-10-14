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

    /* Julian: on a phone and an iPad the photographs drift apart as the
       page scrolls, the near ones (`--fz`) faster than the far, so the
       depth they hang at shows, and the words with them, slower. The
       motion is CSS on a scroll timeline (`[data-par]`, `cover.css`);
       this names the timeline on what scrolls the cover and works out
       each layer's travel once. */
    const section = el.closest("section");
    if (section && !/[?&]tilt=1/.test(location.search)) {
      let scroller: HTMLElement = document.documentElement;
      /* Again on a turn of the iPad or the phone (a new width), not on
         Safari's bar folding away mid-scroll, which only changes the
         height: the range moving under a finger would jump. */
      let wide = 0;
      const set = () => {
        if (innerWidth === wide) return;
        wide = innerWidth;
        scroller.style.removeProperty("scroll-timeline");
        let box: HTMLElement | null = el.parentElement;
        // The window on a phone; the deck, which runs sideways, on an iPad.
        while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY + getComputedStyle(box).overflowX)) box = box.parentElement;
        const side = !!box && box.scrollWidth > box.clientWidth;
        scroller = box ?? document.documentElement;
        const span = side ? innerWidth : innerHeight;
        scroller.style.setProperty("scroll-timeline", `--hero ${side ? "x" : "y"}`);
        section.style.setProperty("--par-end", `${span}px`);
        for (const f of el.querySelectorAll<HTMLElement>(".cover-float-frame")) {
          /* Julian: subtle, riding with the page (the first cut, 0.15 to
             0.5 and 2400px back, trailed his finger). z runs about -50 to
             150: 0.05 to 0.1 of the scroll. */
          const k = Math.max(0, Math.min(1, (parseFloat(getComputedStyle(f).getPropertyValue("--fz")) + 50) / 200));
          const rate = 0.05 + k * 0.05;
          /* Julian: down, scrolling up and down, as the page lifts past
             them; and back into the space, not too far: a screen's scroll
             sends them 300px to 600px back, the near ones furthest
             (about 0.92 to 0.85 of their size at the cover's 3280px
             perspective). Faded out by half a screen, so none lies over
             the name. */
          f.style.removeProperty(side ? "--par-y" : "--par-x");
          f.style.setProperty(side ? "--par-x" : "--par-y", `${(side ? -span : span) * rate}px`);
          f.style.setProperty("--par-z", `${-(300 + k * 300)}px`);
        }
        /* The name, the role, the line under it and the buttons, each a
           little more than the one above. */
        section.querySelectorAll<HTMLElement>(".cover-float-middle .lift").forEach((f, i) => {
          const rate = 0.015 + i * 0.01;
          f.style.removeProperty(side ? "--par-y" : "--par-x");
          f.style.setProperty(side ? "--par-x" : "--par-y", `${(side ? -span : span) * rate}px`);
        });
      };
      set();
      addEventListener("resize", set);
      section.setAttribute("data-par", "");
      return () => {
        removeEventListener("resize", set);
        section.removeAttribute("data-par");
        scroller.style.removeProperty("scroll-timeline");
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
