"use client";

import * as React from "react";
import { matches } from "@/lib/device";

/* ── the proof cursor ─────────────────────────────────────────────
 * Julian (2026-11-12): over a proof or delivery grid the pointer is a
 * drawn copy of the system arrow, so it can turn. On a photo it tips 16°
 * clockwise; on the pick ring it becomes a +, and × once picked. Off the
 * grid the real cursor is back, in the same pose. Mouse only: the class
 * that hides the system cursor is set here, so touch and no-JS keep it.
 * Styles: `.proof-cur` in proof.css.
 * ─────────────────────────────────────────────────────────────── */
export function ProofCursor() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [mac, setMac] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !matches("fine")) return;
    setMac(/Mac/.test(navigator.platform));
    const root = document.documentElement;
    root.classList.add("proof-cur-on");
    let x = 0;
    let y = 0;
    let frame = 0;
    let last: Element | null = null;
    const read = (t: Element | null) => {
      last = t;
      const grid = t?.closest(".proof-grid");
      const mark = t?.closest(".proof-mark");
      el.toggleAttribute("data-on", !!grid);
      el.toggleAttribute("data-cell", !!t?.closest(".proof-cell"));
      el.toggleAttribute("data-ring", !!mark);
      el.toggleAttribute("data-picked", mark?.getAttribute("aria-pressed") === "true");
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (e.target !== last) read(e.target as Element);
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        el.style.transform = `translate3d(${x}px,${y}px,0)`;
      });
    };
    // The page scrolls under a still pointer, and a pick flips the ring: read what is under it again.
    const again = () => read(document.elementFromPoint(x, y));
    const picked = () => requestAnimationFrame(again); // after React paints the new aria-pressed
    const out = () => read(null);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("scroll", again, { passive: true });
    addEventListener("click", picked);
    root.addEventListener("pointerleave", out);
    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove("proof-cur-on");
      removeEventListener("pointermove", move);
      removeEventListener("scroll", again);
      removeEventListener("click", picked);
      root.removeEventListener("pointerleave", out);
    };
  }, []);
  return (
    <div ref={ref} className="proof-cur" data-mac={mac || undefined} aria-hidden="true">
      <svg className="proof-cur-a" viewBox="0 0 13 20"><path d="M.5 .5V16.5L4.5 12.8 7.3 19 9.8 17.9 7.1 11.8H12.5Z" /></svg>
      <svg className="proof-cur-p" viewBox="0 0 16 16"><path d="M8 1V15M1 8H15" /></svg>
    </div>
  );
}
