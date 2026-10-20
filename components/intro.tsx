"use client";

import * as React from "react";
import { BlinkingMark } from "@/components/not-found-scene";

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
 *   from the first byte, and the whole opening takes 3s from the first
 *   paint, whatever is still loading.
 *
 *   It runs once a visit, on whichever page the visit starts on.
 *   `sessionStorage` remembers. Julian: use the splash screen as a loader,
 *   so the lag of a first load is never seen. It was the homepage only,
 *   and a first visit straight to /work got the lag with nothing over it.
 *
 *   It is skipped for anybody who asks their system for less motion.
 *
 * All three decisions are made by the inline script in `layout.tsx`
 * before the first paint. The stylesheet keeps this layer hidden unless
 * that script has set `data-intro`, so a visitor with no JavaScript is
 * never shut behind a curtain that cannot lift.
 * ─────────────────────────────────────────────────────────────── */

/* Julian: the motion of basis's opening, measured off his recording of it.
   The sweep is quick to start and slows into full; it holds full; then the
   whole panel, eye and all, lifts off the top of the screen, gathering
   speed. */
const OUT = 1000; // the lift
/* The lift should reveal the hero. It lifted off a page whose
   entrance had not started, black under black, so only the eye
   seemed to move. Here the page starts its entrance under the full
   panel, and the panel holds this long before it lifts, uncovering
   the name already up and the photographs landing. */
const UNDER = 450;

const lift = () => document.documentElement.removeAttribute("data-intro");

/* Preview, `?splash=basic`: basicagency.com's opening, from the teardown
   in SITE TEARDOWN/basicagency. The name alone on the page ground; at
   500ms it lifts off the top while the first screen slides up in under
   it over a second; then the header's logo and each item fade and rise,
   500ms each, 25ms apart. No sweep, no eye. */
const SOFT = "cubic-bezier(0.28, 0, 0.49, 1)";
function basic(box: HTMLDivElement | null) {
  const root = document.documentElement;
  setTimeout(() => {
    root.dataset.intro = "half";
    root.dataset.splashed = "";
    box?.classList.add("jg-intro-open");
    box?.animate([{ transform: "none" }, { transform: "translateY(-100%)" }], {
      duration: 500,
      easing: SOFT,
      fill: "forwards",
    });
    document.querySelector("main")?.animate(
      [{ transform: "translateY(100%)" }, { transform: "none" }],
      { duration: 1000, easing: "cubic-bezier(0.72, 0, 0.28, 1)" },
    );
    document
      .querySelectorAll(".site-bar .page-column > a, .site-bar nav li, .site-bar .page-column > div > :not(nav)")
      .forEach((el, i) =>
        el.animate(
          [{ opacity: 0, transform: "translateY(100%)" }, { opacity: 1, transform: "none" }],
          { duration: 500, delay: 500 + i * 25, easing: SOFT, fill: "backwards" },
        ),
      );
    setTimeout(lift, 500);
  }, 500);
}

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

    if (root.dataset.splash === "basic") return basic(box.current);

    /* The sweep runs as an animation the browser moves on its own, off the
       main thread, from the first paint (`jg-intro-sweep`, `globals.css`):
       quick to start, slowing into full. Nothing holds it back.

       Julian: "not smooth, make it 3s". Held back to what had loaded,
       it stopped and started, and the page starting its entrance under
       it froze it for a sixth of a second on a phone. Now it never
       stops, the page starts only once it is full, and the whole
       opening is a fixed 3s from the first paint: sweep, hold, lift. */
    // The sweep is 1550ms in `globals.css`.
    const sweep: Animation | undefined = panel.current?.getAnimations()[0];
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    /* Julian: one blink, before the sweep's edge reaches the eye (it
       was two). Played by the stylesheet (`jg-intro-blink`), at
       a random moment picked in `layout.tsx`, so it keeps the sweep's
       time. */

    Promise.resolve(sweep?.finished)
      .catch(() => {})
      .then(async () => {
        root.dataset.intro = "lift";
        /* Julian (2026-10-14): the eye stays on and leaves with the
           panel (it used to fade out first, so the sheet left empty). */
        await wait(UNDER);
        box.current?.classList.add("jg-intro-open");
        box.current?.animate(
          /* Past the top by the shadow its foot casts (`globals.css`), so the
             shadow leaves with it and does not vanish when the layer goes. */
          [{ transform: "translateY(0)" }, { transform: "translateY(calc(-100% - 6rem))" }],
          { duration: OUT, easing: "cubic-bezier(0.76, 0, 0.24, 1)", fill: "forwards" },
        );
        /* The photographs set off with the lift, not after it (they
           popped in too late). `half` unpauses them (`globals.css`);
           the panel is still over them for the first beat, so the
           first ones land as it clears. */
        root.dataset.intro = "half";
        /* And no wait on the first one (`--h-start`, `globals.css`): the
           first photographs land as the panel's foot passes them. Set
           once and kept, so the delay never changes under a running
           animation. */
        root.dataset.splashed = "";
        setTimeout(lift, OUT);
      });
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
        <div className="jg-intro-word">Julian Gigola</div>
      </div>
    </>
  );
}
