"use client";

import * as React from "react";
import { frameDt, springSettled, stepSpring, type SpringState } from "@/lib/motion/spring";

/* The page's own scrollbar, behind `?sb=1` (`?sb=0` turns it off again):
   a hairline thumb that trails the scroll on the lift's spring, so it
   glides and settles instead of jumping. Drag it to scroll. Mouse only;
   touch keeps the system's overlay bar. */
export function ScrollThumb() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    let on = false;
    try {
      const q = location.search;
      if (/[?&]sb=1/.test(q)) sessionStorage.setItem("jg-sb", "1");
      else if (/[?&]sb=0/.test(q)) sessionStorage.removeItem("jg-sb");
      on = !!sessionStorage.getItem("jg-sb") && matchMedia("(pointer:fine)").matches;
    } catch {}
    if (!on || !el) return;
    const root = document.documentElement;
    root.dataset.sb = "";
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const PAD = 6;
    let s: SpringState = { x: 0, v: 0 };
    let raf = 0, at = 0, idle = 0, drag: { dy: number } | null = null;

    const geo = () => {
      const vh = innerHeight, sh = root.scrollHeight, max = sh - vh;
      const h = Math.max(32, (vh - 2 * PAD) * (vh / sh));
      return { max, h, room: vh - 2 * PAD - h };
    };
    const target = () => {
      const { max, room } = geo();
      return max > 0 ? PAD + (scrollY / max) * room : PAD;
    };
    const paint = () => {
      const { max, h } = geo();
      el.hidden = max <= 1;
      el.style.height = `${h}px`;
      el.style.transform = `translateY(${s.x}px)`;
    };
    const wake = () => {
      el.dataset.live = "";
      clearTimeout(idle);
      idle = window.setTimeout(() => { if (!drag) delete el.dataset.live; }, 900);
    };
    const tick = (now: number) => {
      const t = target();
      s = calm || drag ? { x: t, v: 0 } : stepSpring(s, t, 0.85, frameDt(now, at));
      at = now;
      paint();
      if (springSettled(s, t)) { s = { x: t, v: 0 }; paint(); raf = 0; at = 0; return; }
      raf = requestAnimationFrame(tick);
    };
    const go = () => { wake(); if (!raf) raf = requestAnimationFrame(tick); };

    const down = (e: PointerEvent) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      drag = { dy: e.clientY - el.getBoundingClientRect().top };
      el.dataset.drag = "";
      wake();
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const { max, room } = geo();
      if (room > 0) scrollTo({ top: ((e.clientY - drag.dy - PAD) / room) * max, behavior: "instant" });
    };
    const up = () => { drag = null; delete el.dataset.drag; wake(); };

    s = { x: target(), v: 0 };
    paint();
    addEventListener("scroll", go, { passive: true });
    addEventListener("resize", go);
    const ro = new ResizeObserver(go);
    ro.observe(document.body);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      delete root.dataset.sb;
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      removeEventListener("scroll", go);
      removeEventListener("resize", go);
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);

  return <div ref={ref} className="sb-thumb" aria-hidden="true" hidden />;
}
