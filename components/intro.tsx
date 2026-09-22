"use client";

import * as React from "react";

/* ── the opening ──────────────────────────────────────────────────
 * The eye mark opens, blinks, and hands the screen to the site.
 *
 * Every frame is the logo's own geometry recomputed rather than a video
 * or a stack of masks laid over it. A lens is two arcs meeting at the
 * corners, so a half width and a rise give the radius back:
 * r = (a² + s²) / 2s. The logo's 42.8 and 18.0 return 59.88, which is the
 * 59.9 in `app/icon.svg`, so the resting frame of this animation is the
 * artwork itself and not a copy of it.
 *
 * Three rules it lives by, because an intro sits between a visitor and
 * the work:
 *
 *   It never holds the page. The site is rendered underneath from the
 *   first byte and this is a layer over the top with `pointer-events:
 *   none`, so a press during it lands on whatever is beneath.
 *
 *   It runs once a visit, not once a page. `sessionStorage` remembers,
 *   so moving between Work and Sessions never replays it.
 *
 *   It is skipped for anybody who asks their system for less motion.
 *
 * All three decisions are made by the inline script in `layout.tsx`
 * before the first paint, which is the only place they can be made
 * without a frame of the site showing first. This component draws the
 * mark on the server either way and the stylesheet keeps it hidden
 * unless that script has set `data-intro`, so a visitor with no
 * JavaScript is never shut behind a curtain that cannot lift.
 * ─────────────────────────────────────────────────────────────── */

const CY = 49.6;
const A = 42.8;
const S = 18.0;
const TAKE = 1000; // the mark: open, hold, blink, settle
const FADE = 620; // the ground going, once the mark has settled
const CUE = 0.94; // the ending starts before the mark has quite settled

const radius = (a: number, s: number) => (a * a + s * s) / (2 * Math.max(s, 0.18));

/** The lens, from a half width and the rise of each arc. */
function lens(a: number, top: number, bot: number) {
  const x0 = (50 - a).toFixed(3);
  const x1 = (50 + a).toFixed(3);
  const rt = radius(a, top).toFixed(3);
  const rb = radius(a, bot).toFixed(3);
  return `M${x0} ${CY} A${rt} ${rt} 0 0 1 ${x1} ${CY} A${rb} ${rb} 0 0 1 ${x0} ${CY} Z`;
}

const mix = (from: number, to: number, t: number) => from + (to - from) * t;
const glide = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

type Key = [at: number, value: number, ease?: (t: number) => number];

/** Keyframes, interpolated. Written this way the value is continuous by
    construction; crossfading two eased ramps leaves a jump in the
    velocity where they meet, which is what a blink that snaps looks
    like. */
function track(t: number, keys: Key[]) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, ease] = keys[i];
    const [t0, v0] = keys[i - 1];
    if (t <= t1) {
      const k = t1 === t0 ? 1 : (t - t0) / (t1 - t0);
      return mix(v0, v1, (ease ?? glide)(k));
    }
  }
  return keys[keys.length - 1][1];
}

/* The lens grows outward along its own axis from a short line, so the
   shape arrives rather than being uncovered, and the iris opens from
   just under its drawn size: far enough to read as movement, not so far
   that it reads as a zoom. Then one slow blink, and it rests on the
   artwork. */
const frame = (t: number) => ({
  a: track(t, [[0, 14], [0.44, A]]),
  s: track(t, [[0, 1.2], [0.46, S], [0.58, S], [0.76, 0.4], [0.98, S]]),
  iris: track(t, [[0, 0.82], [0.5, 1]]),
  pupil: track(t, [[0, 0.78], [0.56, 1]]),
});

export function Intro() {
  const box = React.useRef<HTMLDivElement>(null);
  const path = React.useRef<SVGPathElement>(null);
  const clip = React.useRef<SVGPathElement>(null);
  const iris = React.useRef<SVGGElement>(null);
  const eye = React.useRef<SVGGElement>(null);
  const dot = React.useRef<SVGCircleElement>(null);

  React.useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "1") return;
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}

    const draw = (f: ReturnType<typeof frame>) => {
      const d = lens(f.a, f.s, f.s);
      path.current?.setAttribute("d", d);
      clip.current?.setAttribute("d", d);
      const scale = `scale(${f.iris})`;
      if (iris.current) iris.current.style.transform = scale;
      if (eye.current) eye.current.style.transform = scale;
      dot.current?.setAttribute("r", (8.6 * f.pupil).toFixed(3));
    };

    let raf = 0;
    /* Julian: the opening through the pupil looked bad, so it is gone.
       What is here instead is the quietest ending there is — the ground
       the mark stands on fades and the site is already behind it. It is
       not the final answer, it is the one that cannot look wrong while
       the better ones are being chosen. */
    const leave = () => {
      const el = box.current;
      if (!el) return;
      el.classList.add("jg-intro-out");
      window.setTimeout(() => root.removeAttribute("data-intro"), FADE + 40);
    };

    const t0 = performance.now();
    let cued = false;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / TAKE);
      draw(frame(t));
      if (!cued && t >= CUE) {
        cued = true;
        leave();
      }
      if (t < 1) raf = requestAnimationFrame(step);
    };
    draw(frame(0));
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div id="jg-intro" ref={box} aria-hidden="true">
      <svg viewBox="0 0 100 100" focusable="false">
        <defs>
          <clipPath id="jg-intro-clip">
            <path ref={clip} d={lens(14, 1.2, 1.2)} />
          </clipPath>
        </defs>
        {/* The lens is the ink, the iris is the ground punched back
            through it, the pupil is the ink again: the same three fills
            the file has, in the same order. The iris is not clipped,
            because the ground colour on the ground is already invisible
            and a clip leaves the lens's own anti-aliased edge showing as
            a thread along the top arc. */}
        <path ref={path} className="jg-intro-lens" d={lens(14, 1.2, 1.2)} />
        <g ref={iris} className="jg-intro-inner">
          <circle className="jg-intro-iris" cx="50" cy="40.9" r="20.7" />
        </g>
        <g clipPath="url(#jg-intro-clip)">
          <g ref={eye} className="jg-intro-inner">
            <circle
              ref={dot}
              className="jg-intro-pupil"
              cx="50"
              cy="40.9"
              r="6.7"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
