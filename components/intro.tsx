"use client";

import * as React from "react";
import { BlinkingMark, blink } from "@/components/not-found-scene";

/* ── the opening ──────────────────────────────────────────────────
 * The screen is the loading bar. A panel in the ink of the theme sweeps in
 * from the left as the page gets ready, the eye in the middle turning
 * over where the panel passes under it, and at full it lifts off the top
 * of the screen, eye and all, with the page arriving behind it. Julian
 * took the sweep from skvarenina.com and the lift from basis, without the
 * percentage.
 *
 * Three rules it lives by, because an intro sits between a visitor and
 * the work:
 *
 *   It never holds the page for long. The site is rendered underneath
 *   from the first byte, and the panel fills at `CAP` whatever is still
 *   loading.
 *
 *   It runs once a visit, on the homepage. `sessionStorage` remembers.
 *
 *   It is skipped for anybody who asks their system for less motion.
 *
 * All three decisions are made by the inline script in `layout.tsx`
 * before the first paint. The stylesheet keeps this layer hidden unless
 * that script has set `data-intro`, so a visitor with no JavaScript is
 * never shut behind a curtain that cannot lift.
 * ─────────────────────────────────────────────────────────────── */

/* Julian: the motion of basis's opening, measured off his recording of it.
   The sweep is quick to start and slows into full, 43% at half a second
   and 98% at a second and a half; it holds full a beat; then the whole
   panel, eye and all, lifts off the top of the screen, gathering speed. */
const CAP = 5000; // the longest anybody waits, whatever is still loading
const FILL = 1900; // the panel's sweep, when the page is quicker
const HOLD = 450; // full, before it lifts
const OUT = 1000; // the lift

const lift = () => document.documentElement.removeAttribute("data-intro");

/* Once per page load. React remounts effects in development, and a second
   take would start a sweep the first had already finished. */
let played = false;

export function Intro() {
  const box = React.useRef<HTMLDivElement>(null);
  const panel = React.useRef<HTMLDivElement>(null);
  const eye = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "1" || played) return;
    played = true;
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}

    /* What "ready" means: the type, every photograph already on screen
       that is not lazy, and the window's own load. The panel sweeps on a
       steady curve over `FILL` and never runs ahead of those. */
    const tasks: Promise<unknown>[] = [document.fonts.ready];
    if (document.readyState !== "complete") {
      tasks.push(
        new Promise((r) => window.addEventListener("load", r, { once: true })),
      );
    }
    for (const img of Array.from(document.images)) {
      if (img.complete || img.loading === "lazy") continue;
      if (img.getBoundingClientRect().top > window.innerHeight) continue;
      tasks.push(
        new Promise((r) => {
          img.addEventListener("load", r, { once: true });
          img.addEventListener("error", r, { once: true });
        }),
      );
    }
    let done = 0;
    for (const t of tasks) t.then(() => done++);

    const lids = () => eye.current?.querySelector("[data-lids]");
    let blinked = false;
    const t0 = performance.now();
    let shown = 0;
    const step = (now: number) => {
      const since = Math.max(0, now - t0);
      const real = done / tasks.length;
      const t = Math.min(1, since / FILL);
      const target = since >= CAP ? 1 : Math.min(real, 1 - (1 - t) * (1 - t));
      shown += (target - shown) * 0.12;
      if (target - shown < 0.002) shown = target;
      if (panel.current)
        panel.current.style.clipPath = `inset(0 ${(1 - shown) * 100}% 0 0)`;
      const l = lids();
      if (l && !blinked && shown >= 0.5) {
        blinked = true;
        blink(l);
      }
      if (shown < 1) {
        requestAnimationFrame(step);
        return;
      }
      /* Full. A beat, then the layer lifts off the top of the screen, and
         the page starts its own entrance under it at the same moment. */
      setTimeout(() => {
        box.current?.classList.add("jg-intro-open");
        root.dataset.intro = "lift";
        box.current?.animate(
          [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
          { duration: OUT, easing: "cubic-bezier(0.76, 0, 0.24, 1)", fill: "forwards" },
        );
        setTimeout(lift, OUT);
      }, HOLD);
    };
    requestAnimationFrame(step);
  }, []);

  return (
    <>
      {/* The one rule that cannot wait for the stylesheet. The layer is in
          the server's HTML and the styles are in separate files, so there
          is a window between the document arriving and the CSS applying
          in which it has no rules at all and would lay itself out in the
          flow. Carried inline it is there from the first byte, and
          `[data-intro] #jg-intro` in the stylesheet still wins on
          specificity when it comes. */}
      <style>{"#jg-intro{display:none}"}</style>
      <div id="jg-intro" ref={box} aria-hidden="true">
        <div ref={panel} className="jg-intro-panel" />
        <div ref={eye} className="jg-intro-eye">
          <BlinkingMark still />
        </div>
      </div>
    </>
  );
}
