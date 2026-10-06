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
/* Julian (2026-10-01): the lift should reveal the hero. It
   lifted off a page whose entrance had not started, black under black,
   so only the eye seemed to move. Here the page starts its entrance
   under the full panel, and the panel holds this long before it lifts,
   uncovering the name already up and the photographs landing. */
const UNDER = 450;

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

    /* Preview (`?deal=ripple|rise|sweep`, 2026-10-06): other landing
       orders, from where each frame actually sits. Ripple: out from the
       name. Rise: bottom first, behind the lifting panel. Sweep: left to
       right, the way the panel came in. Top: the top four together
       (Julian), then the rest top to bottom; `topall`: the rest together.
       Drift: all at once, the top ones drifting down slowly, the bottom
       ones easing up (Julian; `jg-drift`, `globals.css`). */
    const mode = root.dataset.deal;
    if (mode === "ripple" || mode === "rise" || mode === "sweep" || mode === "top" || mode === "topall" || mode === "drift") {
      const els = Array.from(document.querySelectorAll<HTMLElement>(".cover-float-frame")).filter(
        (el) => el.getBoundingClientRect().width > 0,
      );
      const at = els.map((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2 - innerWidth / 2;
        const y = r.top + r.height / 2 - innerHeight / 2;
        return mode === "ripple" ? Math.hypot(x, y) : mode === "rise" ? -y : mode === "sweep" ? x : y;
      });
      if (mode === "drift") {
        els.forEach((el, i) => {
          el.style.setProperty("--wave-now", "0");
          if (at[i] < 0) el.dataset.drift = "";
        });
      } else if (mode === "top" || mode === "topall") {
        const cut = [...at].sort((a, b) => a - b)[3];
        const rest = at.filter((y) => y > cut);
        const lo = Math.min(...rest);
        const hi = Math.max(...rest);
        els.forEach((el, i) => {
          const w =
            at[i] <= cut ? 0 : mode === "topall" || hi === lo ? 600 : 600 + Math.round(((at[i] - lo) / (hi - lo)) * 600);
          el.style.setProperty("--wave-now", String(w));
        });
      } else {
        const lo = Math.min(...at);
        const hi = Math.max(...at);
        els.forEach((el, i) =>
          el.style.setProperty("--wave-now", String(hi > lo ? Math.round(((at[i] - lo) / (hi - lo)) * 1340) : 0)),
        );
      }
    }

    /* The sweep runs as an animation the browser moves on its own, off the
       main thread, from the first paint (`jg-intro-sweep`, `globals.css`):
       quick to start, slowing into full. Nothing holds it back.

       Julian (2026-10-06): "not smooth, make it 3s". Held back to what had
       loaded, it stopped and started, and the page starting its entrance
       under it froze it for a sixth of a second on a phone. Now it never
       stops, the page starts only once it is full, and the whole opening
       is a fixed 3s from the first paint: sweep, hold, lift. */
    // The sweep is 1550ms in `globals.css`.
    const sweep: Animation | undefined = panel.current?.getAnimations()[0];
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    /* Julian: one blink, before the sweep's edge reaches the eye (it was
       two until 2026-10-06). Played by the stylesheet (`jg-intro-blink`),
       at a random moment picked in `layout.tsx`, so it keeps the sweep's
       time. */

    Promise.resolve(sweep?.finished)
      .catch(() => {})
      .then(async () => {
        root.dataset.intro = "lift";
        /* Julian (2026-10-06): the eye fades out before the panel lifts,
           so the sheet leaves empty. */
        eye.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 420,
          delay: UNDER - 420,
          easing: "cubic-bezier(0.45, 0, 0.55, 1)",
          fill: "forwards",
        });
        await wait(UNDER);
        box.current?.classList.add("jg-intro-open");
        box.current?.animate(
          /* Past the top by the shadow its foot casts (`globals.css`), so the
             shadow leaves with it and does not vanish when the layer goes. */
          [{ transform: "translateY(0)" }, { transform: "translateY(calc(-100% - 6rem))" }],
          { duration: OUT, easing: "cubic-bezier(0.76, 0, 0.24, 1)", fill: "forwards" },
        );
        /* Julian (2026-10-06): the photographs set off with the lift, not
           after it (they popped in too late). `half` unpauses them
           (`globals.css`); the panel is still over them for the first
           beat, so the first ones land as it clears. */
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
      </div>
    </>
  );
}
