"use client";

import * as React from "react";

/* ── the light on the glass ───────────────────────────────────────
 * Liquid Glass reacts to the pointer: a soft highlight sits where the light
 * would catch the surface, and moves with the hand. The material itself is
 * CSS (`glass` in `globals.css`); this is the one thing CSS cannot know —
 * where the pointer is — written as two custom properties on the element
 * under it, which the highlight's gradient reads.
 *
 * One listener on the document rather than one per control, and nothing on
 * a phone: there is no pointer to follow, and the highlight has a resting
 * position at the top edge for that case.
 * ─────────────────────────────────────────────────────────────── */

const GLASS = ".glass, .glass-prominent, .action, .action-quiet";

export function GlassLight() {
  React.useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(GLASS);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--gx", `${e.clientX - r.left}px`);
      el.style.setProperty("--gy", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", move, { passive: true });
    return () => document.removeEventListener("pointermove", move);
  }, []);

  return null;
}
