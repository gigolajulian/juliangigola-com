"use client";

import * as React from "react";
import { gsap } from "gsap";

/* ── the cover's entrance ─────────────────────────────────────────
 * Julian (2026-10-14): the photographs come in from outside the page and
 * gather where they sit, solid all the way, no fade and no rise. Each on
 * the line from the middle of the screen out through its own place, in
 * two waves: every other frame in their landing order (`--order`,
 * `cover-float.tsx`), then the rest `WAVE` after. GSAP, the first of
 * the site's motion moved to it.
 *
 * Held while the opening is up and set off as it lifts (`data-intro`,
 * `intro.tsx`); straight away when there is no opening. Until this has
 * put them outside the page they are hidden (`data-gather`, set before
 * the first paint in `layout.tsx`), so none shows in place first.
 * ─────────────────────────────────────────────────────────────── */

const FLY = 1.3; // s
const WAVE = 0.15; // s, the second wave after the first

export function HeroGather() {
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const show = () => {
      delete root.dataset.gather;
    };
    const frames = Array.from(document.querySelectorAll<HTMLElement>(".cover-float-frame")).filter(
      (f) => f.getBoundingClientRect().width > 0,
    );
    if (!frames.length || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      show();
      return;
    }

    const order = (f: HTMLElement) => parseFloat(getComputedStyle(f).getPropertyValue("--order")) || 0;
    const rank = new Map([...frames].sort((a, b) => order(a) - order(b)).map((f, i) => [f, i]));
    for (const f of frames) {
      const r = f.getBoundingClientRect();
      const dx = r.left + r.width / 2 - innerWidth / 2;
      const dy = r.top + r.height / 2 - innerHeight / 2;
      const d = Math.hypot(dx, dy) || 1;
      // Far enough along that line to clear the screen's edge.
      const out = Math.hypot(innerWidth, innerHeight) / 2 + Math.max(r.width, r.height);
      gsap.set(f, { x: (dx / d) * out, y: (dy / d) * out });
    }
    show();

    const go = () =>
      frames.forEach((f) =>
        gsap.to(f, {
          x: 0,
          y: 0,
          duration: FLY,
          ease: "expo.out",
          delay: 0.05 + (rank.get(f)! % 2) * WAVE,
          // Nothing left behind once it lands (`clearProps` left an identity
          // transform on a phone).
          onComplete: () => f.style.removeProperty("transform"),
        }),
      );
    const held = () => root.dataset.intro === "1" || root.dataset.intro === "lift";
    if (!held()) go();
    const watch = new MutationObserver(() => {
      if (held()) return;
      watch.disconnect();
      go();
    });
    if (held()) watch.observe(root, { attributes: true, attributeFilter: ["data-intro"] });
    return () => {
      watch.disconnect();
      gsap.killTweensOf(frames);
      gsap.set(frames, { clearProps: "transform" });
    };
  }, []);
  return null;
}
