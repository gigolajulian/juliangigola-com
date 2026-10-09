"use client";

import * as React from "react";
import { matches } from "@/lib/device";

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

const GLASS = ".glass, .glass-prominent";

/* Julian: the buttons like his recording. Their fill floods in as a
   circle from where the pointer came in and drains out toward where it
   left (`::before` on these in `globals.css`). Written as shares of the
   button, not pixels, so the homepage's zoomed pair reads them right:
   the point it crossed the edge, and the circle's size, twice the
   diagonal, so it covers the button from any point on it. */
const FLOOD = ".action, .action-quiet, .cover-cta";

export function GlassLight() {
  React.useEffect(() => {
    if (!matches("fine")) {
      return;
    }
    const move = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(GLASS);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--gx", `${e.clientX - r.left}px`);
      el.style.setProperty("--gy", `${e.clientY - r.top}px`);
    };
    const edge = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>(FLOOD);
      if (!el || el.contains(e.relatedTarget as Node | null)) return;
      const r = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      el.style.setProperty("--fx", `${x * 100}%`);
      el.style.setProperty("--fy", `${y * 100}%`);
      el.style.setProperty("--fd", `${200 * Math.hypot(1, r.height / r.width)}%`);
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", edge, { passive: true });
    document.addEventListener("pointerout", edge, { passive: true });
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", edge);
      document.removeEventListener("pointerout", edge);
    };
  }, []);

  return null;
}
