"use client";

import * as React from "react";
import { v4pages } from "@/lib/v4pages";

/** `?v4pages=tilt`: the home hero's pointer depth (components/v4/home/motion/depth.ts),
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
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0, timer = 0, hold = false;
    const flat = () => (el?.style.removeProperty("transform"), el?.style.removeProperty("transform-origin"));
    const draw = () => {
      // the canvas mounts after its button is pressed: look again when the view is gone
      if (!el?.isConnected) (flat(), (el = pick()));
      // while the page scrolls the grid straightens, fast: lean and scroll motion together cost
      // frames, and a wall that moves should not also swing (0.08 left 0.8deg 60ms in, MAC)
      const gx = hold ? 0 : tx, gy = hold ? 0 : ty, k = hold ? 0.3 : 0.08;
      cx += (gx - cx) * k;
      cy += (gy - cy) * k;
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
    /* Its own scroll watch, not v4/drift.tsx's `data-v4lag`: that one needs scroll timelines, so in Safari
       the tilt never straightened and the hover zoom ran on (v4pages.css reads `data-v4scroll`). */
    const scroll = () => {
      hold = true;
      el?.setAttribute("data-v4scroll", "");
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        hold = false;
        el?.removeAttribute("data-v4scroll");
        raf ||= requestAnimationFrame(draw);
      }, 160);
      raf ||= requestAnimationFrame(draw);
    };
    addEventListener("pointermove", move, { passive: true });
    addEventListener("scroll", scroll, { passive: true });
    addEventListener("wheel", scroll, { passive: true }); // WebKit sends the first scroll event a frame or two late
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      el?.removeAttribute("data-v4scroll");
      removeEventListener("pointermove", move);
      removeEventListener("scroll", scroll);
      removeEventListener("wheel", scroll);
      document.documentElement.removeEventListener("mouseleave", leave);
      flat();
    };
  }, [k]);
  return null;
}
