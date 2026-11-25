"use client";

import { useEffect, useRef } from "react";

/* About's client marks (a2): one line on the charcoal band that drifts
   and that scroll pushes, the numbers V4's band uses (mt/motion/commissions.ts).
   The row scrolls sideways natively: that is its touch and reduced-motion form. */
const IDLE = 0.028; // px/ms
const GAIN = 0.0012; // px/ms of push per px scrolled in a frame
const MAX = 0.6; // px/ms
const MAX_PHONE = 0.35;

export function LogoBand({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current;
    const track = row?.firstElementChild as HTMLElement | null;
    if (!row || !track || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const set = [...track.children];
    const w = track.scrollWidth; // one set, before any copy
    if (!w) return;
    const copies: Element[] = [];
    const fill = () => {
      // enough copies that the line never runs out
      for (let n = (Math.ceil(row.clientWidth / w) + 1) * set.length; track.children.length < n;) {
        for (const c of set) {
          const k = c.cloneNode(true) as Element;
          k.setAttribute("aria-hidden", "true");
          copies.push(track.appendChild(k));
        }
      }
    };
    const ro = new ResizeObserver(fill);
    ro.observe(row);
    const max = matchMedia("(pointer:coarse)").matches ? MAX_PHONE : MAX;
    let x = 0,
      v = IDLE,
      kick = 0,
      last = 0,
      y = scrollY,
      hover = false,
      raf = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(t - (last || t), 50);
      last = t;
      const dy = scrollY - y;
      y = scrollY;
      kick = Math.max(-max, Math.min(max, kick * 0.94 ** (dt / 16.7) + dy * GAIN));
      v += ((hover ? 0 : IDLE) + kick - v) * (1 - Math.exp(-dt / 180));
      x = (((x + v * dt) % w) + w) % w;
      track.style.transform = `translate3d(${-x}px,0,0)`;
    };
    // only while the band is on screen
    const see = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      last = 0;
      y = scrollY;
      if (e.isIntersecting) raf = requestAnimationFrame(tick);
    });
    see.observe(row);
    const enter = () => (hover = true);
    const leave = () => (hover = false);
    // Keyboard focus holds it too, so the arrow keys scroll a still row (WCAG 2.2.2).
    row.addEventListener("pointerenter", enter);
    row.addEventListener("pointerleave", leave);
    row.addEventListener("focus", enter);
    row.addEventListener("blur", leave);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      see.disconnect();
      row.removeEventListener("pointerenter", enter);
      row.removeEventListener("pointerleave", leave);
      row.removeEventListener("focus", enter);
      row.removeEventListener("blur", leave);
      copies.forEach((n) => n.remove());
      track.style.transform = "";
    };
  }, []);
  return (
    // It scrolls sideways, so it takes focus for keyboard scrolling (axe scrollable-region-focusable).
    <div className="lg-row" ref={ref} tabIndex={0} role="region" aria-label="Client marks">
      <div className="lg">{children}</div>
    </div>
  );
}
