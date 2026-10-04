"use client";

import * as React from "react";

/* ── the focus field ──────────────────────────────────────────────
 * Julian (2026-10-04): a hover that spans the gallery. One blurring layer
 * (`.focus-field`, globals.css) is laid over whichever gallery the
 * pointer is in, clear round the pointer: the frames near it come into
 * focus and the rest go out of it by degrees, the further the softer.
 * One layer for every gallery, moved with the pointer once a frame, so
 * nothing in the galleries themselves is touched.
 * ─────────────────────────────────────────────────────────────── */
const GALLERIES = ".light-table, .portfolio-arrive .strip-scroll, .contact-sheet";
const CELLS = ".light-cell, .strip-cell, .contact-sheet button";

export function FocusField() {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    let on: Element | null = null;
    const place = () => {
      frame = 0;
      if (!on) return void delete el.dataset.on;
      const r = on.getBoundingClientRect();
      el.style.left = `${r.left}px`;
      el.style.top = `${r.top}px`;
      el.style.width = `${r.width}px`;
      el.style.height = `${r.height}px`;
      el.style.setProperty("--ff-x", `${x - r.left}px`);
      el.style.setProperty("--ff-y", `${y - r.top}px`);
      el.dataset.on = "";
    };
    const soon = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      const target = e.target as Element | null;
      const g = target?.closest?.(GALLERIES) ?? null;
      // The clearing is half the frame under the pointer across, so a
      // wide frame and a small one each come into focus whole.
      const cell = g ? target?.closest<HTMLElement>(CELLS) : null;
      if (cell && g?.contains(cell)) {
        el.style.setProperty("--ff-sharp", `${Math.round(cell.offsetWidth * 0.5)}px`);
      }
      on = g;
      soon();
    };
    const leave = () => {
      on = null;
      soon();
    };
    const scrolled = () => on && soon();
    document.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", scrolled, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", scrolled, { capture: true });
    };
  }, []);
  return <div ref={ref} aria-hidden className="focus-field" />;
}
