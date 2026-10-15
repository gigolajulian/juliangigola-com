"use client";

import * as React from "react";
import { gsap } from "gsap";
import { gather } from "@/lib/gather";

/* ── the cover's entrance ─────────────────────────────────────────
 * Julian (2026-10-14): the photographs come in from outside the page and
 * gather where they sit, solid all the way, no fade and no rise. Each on
 * the line from the middle of the screen out through its own place, in
 * two waves by their landing order (`--order`, `cover-float.tsx`); the
 * flight itself is `lib/gather.ts`. GSAP, the first of the site's motion
 * moved to it.
 *
 * Held while the opening is up and set off as it lifts (`data-intro`,
 * `intro.tsx`); straight away when there is no opening. Until this has
 * put them outside the page they are hidden (`data-gather`, set before
 * the first paint in `layout.tsx`), so none shows in place first.
 * ─────────────────────────────────────────────────────────────── */

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

    const go = gather(frames);
    show();

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
