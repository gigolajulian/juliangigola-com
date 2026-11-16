"use client";

import * as React from "react";
import { v4pages } from "@/lib/v4pages";

/** `?v4pages=tilt`: the home hero's pointer depth (components/v3/mt/motion/depth.ts),
    toned down, on /portfolio. The view on screen (grid, strip or canvas field)
    leans toward the mouse by up to 1.1 degrees; the hero wall leans 2.5. One
    eased rAF, one `transform` write a frame on one element, stopped once it
    arrives; flat again when the pointer leaves the window. The grid is taller
    than the screen, so its hinge follows the middle of the viewport, and it
    straightens while the page scrolls.
    Mouse only, never under reduced motion. `k` changes when the view does. */
const MAX = 1.1; // degrees
// first match wins: the canvas (a portal over the page) sits above the grid it covers
const PICK = [".v3 .cv-field", "#p-work .wstrip", "#p-work .wgrid"];
const pick = () => PICK.reduce<HTMLElement | null>((el, s) => el ?? document.querySelector<HTMLElement>(s), null);

export function V4Tilt({ k }: { k: string }) {
  React.useEffect(() => {
    if (!v4pages("tilt") || !matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let el: HTMLElement | null = null;
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const flat = () => (el?.style.removeProperty("transform"), el?.style.removeProperty("transform-origin"));
    const draw = () => {
      // the canvas mounts after its button is pressed: look again when the view is gone
      if (!el?.isConnected) (flat(), (el = pick()));
      // while the page scrolls (`data-v4lag`, v4-drift.tsx) the grid straightens: lean and scroll
      // motion together cost frames, and a wall that moves should not also swing
      const hold = !!el?.hasAttribute("data-v4lag");
      const gx = hold ? 0 : tx, gy = hold ? 0 : ty;
      cx += (gx - cx) * 0.08;
      cy += (gy - cy) * 0.08;
      const still = Math.abs(gx - cx) + Math.abs(gy - cy) < 0.002;
      raf = still ? 0 : requestAnimationFrame(draw);
      if (!el) return;
      if (still && !gx && !gy) return void flat();
      if (el.classList.contains("wgrid")) el.style.transformOrigin = `50% ${(innerHeight / 2 - el.getBoundingClientRect().top).toFixed(0)}px`;
      el.style.transform = `perspective(1400px) rotateX(${(-cy * MAX).toFixed(3)}deg) rotateY(${(cx * MAX).toFixed(3)}deg)`;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = (e.clientX / innerWidth) * 2 - 1;
      ty = (e.clientY / innerHeight) * 2 - 1;
      raf ||= requestAnimationFrame(draw);
    };
    const leave = () => {
      tx = ty = 0;
      raf ||= requestAnimationFrame(draw);
    };
    // the grid's hinge has to keep up with the page
    const scroll = () => (tx || ty) && (raf ||= requestAnimationFrame(draw));
    addEventListener("pointermove", move, { passive: true });
    addEventListener("scroll", scroll, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", move);
      removeEventListener("scroll", scroll);
      document.documentElement.removeEventListener("mouseleave", leave);
      flat();
    };
  }, [k]);
  return null;
}
