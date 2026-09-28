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
   The sweep is quick to start and slows into full, 43% at half a second
   and 98% at a second and a half; it holds full a beat; then the whole
   panel, eye and all, lifts off the top of the screen, gathering speed. */
const CAP = 5000; // the longest anybody waits, whatever is still loading
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

    /* What "ready" means: the type, the window's own load, every
       photograph on screen decoded, and then the page gone quiet. The
       panel sweeps on a steady curve over `SWEEP` and never runs ahead of
       those.

       Julian: the lag of a first load should never be seen. Loaded was
       not enough: the page still had its pictures to decode, the name's
       shader to compile and the hydration to finish, and the lift uncovered
       all of that. So the photographs are waited for decoded, lazy ones
       included when they are on screen (in view, a lazy one loads at
       once), across the screen as well as down it, for the sideways
       strips. */
    const tasks: Promise<unknown>[] = [document.fonts.ready];
    if (document.readyState !== "complete") {
      tasks.push(
        new Promise((r) => window.addEventListener("load", r, { once: true })),
      );
    }
    for (const img of Array.from(document.images)) {
      const r = img.getBoundingClientRect();
      const seen =
        r.width > 0 &&
        r.height > 0 &&
        r.bottom > 0 &&
        r.right > 0 &&
        r.top < window.innerHeight &&
        r.left < window.innerWidth;
      if (seen) tasks.push(img.decode().catch(() => {}));
    }
    /* Then quiet: the name drawn (`data-drawn`, `warp-text.tsx`), and a
       run of 300ms in which no frame took longer than two, so whatever
       was still working under the panel (the hydration, a decode, the
       deck's first layout) has finished before anybody sees the page. */
    tasks.push(
      new Promise<void>((resolve) => {
        let calm = 0;
        let last = performance.now();
        const drawn = () =>
          Array.from(document.querySelectorAll<HTMLElement>(".warp-text")).every(
            (el) => "drawn" in el.dataset || !el.getBoundingClientRect().width,
          );
        const tick = (now: number) => {
          const gap = now - last;
          last = now;
          calm = gap < 34 ? calm + gap : 0;
          if (calm >= 300 && drawn()) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    );
    let done = 0;
    for (const t of tasks) t.then(() => done++);

    /* The sweep runs as an animation the browser moves on its own, off the
       main thread. Drawn from script a frame at a time, it stood still for
       the fifth of a second React takes to bring the page to life
       underneath, halfway across the screen. The curve is the one that
       script drew, sampled: quick to start, slowing into full. It never
       runs ahead of what has loaded, which a check every 50ms holds it to;
       at `CAP` it runs on regardless. */
    const SWEEP = 2100;
    const CURVE = [
      0, 0.0265, 0.0923, 0.1593, 0.2301, 0.3009, 0.3835, 0.4493, 0.5117,
      0.5705, 0.6362, 0.6867, 0.7335, 0.7765, 0.8229, 0.8574, 0.8881,
      0.9149, 0.9419, 0.9603, 0.9748, 0.9854, 0.9922, 0.9964, 1,
    ];
    // When the sweep reaches `p` of the way across, in ms.
    const reaches = (p: number) => {
      const i = CURVE.findIndex((c) => c >= p);
      if (i <= 0) return 0;
      const f = (p - CURVE[i - 1]) / (CURVE[i] - CURVE[i - 1]);
      return ((i - 1 + f) / (CURVE.length - 1)) * SWEEP;
    };
    const frames = [{ transform: "translateX(-100%)" }, { transform: "none" }];
    const timing = { duration: SWEEP, fill: "forwards" as const };
    let sweep: Animation | undefined;
    try {
      sweep = panel.current?.animate(frames, { ...timing, easing: `linear(${CURVE.join(",")})` });
    } catch {
      // No `linear()` easing (an older browser): the nearest curve.
      sweep = panel.current?.animate(frames, { ...timing, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" });
    }

    const lids = () => eye.current?.querySelector("[data-lids]");
    let blinked = false;
    /* Julian: the blink earlier, and sometimes two. A fifth of the way
       across rather than half, and a coin toss for a second blink a beat
       after the first, the way an eye does it. */
    const blinks = (l: Element) => {
      blink(l).finished.then(() => {
        if (Math.random() < 0.5) setTimeout(() => blink(l), 110);
      }, () => {});
    };
    const t0 = performance.now();
    const hold = window.setInterval(() => {
      const real = performance.now() - t0 >= CAP ? 1 : done / tasks.length;
      const at = Number(sweep?.currentTime ?? SWEEP);
      if (real < 1 && at >= reaches(real)) sweep?.pause();
      else if (sweep?.playState === "paused") sweep.play();
      const l = lids();
      if (l && !blinked && at >= reaches(0.2)) {
        blinked = true;
        blinks(l);
      }
    }, 50);

    /* Full. A beat, then the layer lifts off the top of the screen, and
       the page starts its own entrance under it at the same moment. */
    const full = sweep ? sweep.finished : Promise.resolve();
    full
      .catch(() => {})
      .then(() => {
        window.clearInterval(hold);
        const l = lids();
        if (l && !blinked) blinks(l);
        setTimeout(() => {
          box.current?.classList.add("jg-intro-open");
          root.dataset.intro = "lift";
          box.current?.animate(
            [{ transform: "translateY(0)" }, { transform: "translateY(-100%)" }],
            { duration: OUT, easing: "cubic-bezier(0.76, 0, 0.24, 1)", fill: "forwards" },
          );
          setTimeout(lift, OUT);
        }, HOLD);
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
