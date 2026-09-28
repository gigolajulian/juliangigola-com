"use client";

import * as React from "react";
import { shapeNow } from "@/components/hero-dials";

/* ── the cover, turning ───────────────────────────────────────────
 * Julian: once everything settles, the photos go round very slowly, in
 * the same pattern. The places stay exactly as arranged for each screen
 * (`lib/cover-slots.ts`); each photograph travels on into the next place
 * round the name, taking its size and depth as it arrives, one lap in two
 * minutes. It holds still while a photograph is pointed at.
 *
 * Super smooth (Julian): every frame keeps its own place in the layout
 * and rides a looping animation of `translate` and `scale` on top of it,
 * which the compositor runs, so nothing is laid out again and a busy main
 * thread cannot stutter it. The path is a closed Catmull-Rom curve
 * through the places that show, in order of their angle round the middle,
 * measured off the frames themselves and sampled finely enough that the
 * straight runs between keyframes cannot be seen. The start and the hold
 * ease the speed rather than stop it.
 * ─────────────────────────────────────────────────────────────── */

const LAP_MS = 120_000;
/** From the page's own first frame: the entrance is done by about three
    seconds (`ORDER` and `--h-fly-ms`). */
const SETTLE_MS = 3500;
/** Keyframes per place-to-place run. */
const STEPS = 48;
/** Depth, in px, by layout (`--fz`'s source for each). */
const DEPTH = { large: "z", upright: "uz", landscape: "lz", sideways: "sz", phone: "pz" } as const;

type P = [number, number, number, number];

/** A closed Catmull-Rom curve through four places, at `t` of the way from
    `b` to `c`. */
const curve = (a: P, b: P, c: P, d: P, t: number) =>
  b.map(
    (_, k) =>
      0.5 *
      (2 * b[k] +
        (c[k] - a[k]) * t +
        (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t +
        (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t * t * t),
  ) as P;

export function CoverOrbit() {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const cover = ref.current?.closest<HTMLElement>(".cover-float");
    if (!cover || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frames = [...cover.querySelectorAll<HTMLElement>(".cover-float-frame")];

    let anims: Animation[] = [];
    /* How far round, kept across a rebuild (a resize, a rotation). */
    const at = () => {
      const t = anims[0]?.currentTime;
      return typeof t === "number" ? t % LAP_MS : 0;
    };
    /* The speed, eased toward where it is wanted. */
    let rate = 0;
    let want = 0;
    let easing = 0;
    const steer = () => {
      rate += (want - rate) * (want > rate ? 0.012 : 0.15);
      if (Math.abs(want - rate) < 0.001) rate = want;
      anims.forEach((a) => (a.playbackRate = rate));
      easing = rate === want ? 0 : requestAnimationFrame(steer);
    };
    const go = (to: number) => {
      want = to;
      if (!easing) easing = requestAnimationFrame(steer);
    };

    const build = () => {
      const from = at();
      anims.forEach((a) => a.cancel());
      anims = [];
      if (cover.hasAttribute("data-arrange")) return;
      const depth = DEPTH[shapeNow()];
      /* Each place as the layout draws it: the frame's own box, which the
         animation never moves, and its depth. */
      const shown = frames
        .filter((f) => getComputedStyle(f).display !== "none")
        .map((frame) => ({
          frame,
          p: [
            frame.offsetLeft,
            frame.offsetTop,
            frame.offsetWidth,
            parseFloat(frame.style.getPropertyValue(`--${depth}`)) || 0,
          ] as P,
        }));
      const mid = [cover.clientWidth / 2, cover.clientHeight / 2];
      const angle = (p: P) => Math.atan2(p[1] + p[2] / 2 - mid[1], p[0] + p[2] / 2 - mid[0]);
      shown.sort((a, b) => angle(a.p) - angle(b.p));
      const n = shown.length;
      if (n < 3) return;
      const places = shown.map((s) => s.p);
      anims = shown.map(({ frame, p: home }, k) => {
        const keys: Keyframe[] = [];
        for (let m = 0; m <= STEPS * n; m++) {
          const s = k + m / STEPS;
          const i = Math.floor(s) % n;
          const p = curve(
            places[(i - 1 + n) % n],
            places[i],
            places[(i + 1) % n],
            places[(i + 2) % n],
            s - Math.floor(s),
          );
          keys.push({
            offset: m / (STEPS * n),
            translate: `${(p[0] - home[0]).toFixed(2)}px ${(p[1] - home[1]).toFixed(2)}px ${(p[3] - home[3]).toFixed(2)}px`,
            scale: (p[2] / home[2]).toFixed(4),
          });
        }
        frame.style.transformOrigin = "0 0";
        const a = frame.animate(keys, { duration: LAP_MS, iterations: Infinity, easing: "linear" });
        a.currentTime = from;
        a.playbackRate = rate;
        return a;
      });
    };

    /* Held while a photograph is pointed at, and how far forward the
       orbit has carried it noted, so the hover can bring it out in front
       of the rest (`--oz`, `globals.css`). */
    const over = (e: Event) => {
      const frame = (e.target as Element).closest<HTMLElement>(".cover-float-frame");
      if (frame) {
        const z = getComputedStyle(frame).translate.split(" ")[2];
        frame.style.setProperty("--oz", z ?? "0px");
      }
      go(frame ? 0 : 1);
    };
    const out = () => go(1);

    /* Once the opening has gone and the entrance has settled. */
    let settle = 0;
    const start = () => {
      if (document.documentElement.hasAttribute("data-intro")) return;
      intro.disconnect();
      settle = window.setTimeout(() => {
        build();
        go(1);
        cover.addEventListener("pointerover", over);
        cover.addEventListener("pointerleave", out);
      }, SETTLE_MS);
    };
    const intro = new MutationObserver(start);
    intro.observe(document.documentElement, { attributes: true, attributeFilter: ["data-intro"] });
    start();

    /* Again on a new window size or layout, and off while arranging. */
    let queued = 0;
    const again = () => {
      if (!settle) return;
      cancelAnimationFrame(queued);
      queued = requestAnimationFrame(build);
    };
    const sizes = new ResizeObserver(again);
    sizes.observe(cover);
    const arrange = new MutationObserver(again);
    arrange.observe(cover, { attributes: true, attributeFilter: ["data-arrange"] });

    return () => {
      clearTimeout(settle);
      cancelAnimationFrame(queued);
      cancelAnimationFrame(easing);
      intro.disconnect();
      sizes.disconnect();
      arrange.disconnect();
      cover.removeEventListener("pointerover", over);
      cover.removeEventListener("pointerleave", out);
      anims.forEach((a) => a.cancel());
    };
  }, []);

  return <span ref={ref} hidden />;
}
