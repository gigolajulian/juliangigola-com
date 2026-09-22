"use client";

import * as React from "react";

/* ── the opening ──────────────────────────────────────────────────
 * The eye mark opens, blinks, and the site arrives through the pupil.
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
const TAKE = 1500; // the mark: open, hold, blink, settle
const OPEN = 1000; // the pupil opening into the page
const CUE = 0.88; // the opening starts before the mark has quite settled

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
/* A long tail: most of the distance early, then a deceleration that runs
   out of road slowly. It is what makes the opening read as expensive
   rather than as a wipe. */
const expo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

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
  const art = React.useRef<SVGSVGElement>(null);
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

    /* Two loops overlap for the last fraction of a second, so they keep
       their own handles and both are cancelled on the way out. */
    let raf = 0;
    let out = 0;
    /* The pupil is the door. A hole opens where the pupil is — not at the
       centre of the screen, at the pupil — and takes the frame with it.
       The mark is inside the same mask, so it is eaten from the inside
       out rather than faded off the top. */
    const through = () => {
      const el = box.current;
      const mark = art.current;
      if (!el || !mark) return;
      const m = mark.getBoundingClientRect();
      const x = m.left + m.width / 2;
      const y = m.top + m.height * 0.409;
      el.style.setProperty("--hx", `${x}px`);
      el.style.setProperty("--hy", `${y}px`);
      const w = window.innerWidth;
      const h = window.innerHeight;
      const far = Math.max(
        Math.hypot(x, y),
        Math.hypot(w - x, y),
        Math.hypot(x, h - y),
        Math.hypot(w - x, h - y),
      );
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / OPEN);
        const k = expo(t);
        el.style.setProperty("--hole", `${(k * far * 1.02).toFixed(1)}px`);
        /* The feather opens with the hole and closes again at the end, so
           the last frame is a clean page and not a soft ring. */
        el.style.setProperty(
          "--feather",
          `${(Math.sin(Math.PI * t) * 90 + 6).toFixed(1)}px`,
        );
        // the mark hangs a moment, then is drawn out through the hole
        mark.style.transform = `scale(${1 + Math.pow(t, 1.7) * 0.85})`;
        mark.style.opacity = String(1 - Math.pow(t, 2.6));
        if (t < 1) out = requestAnimationFrame(step);
        else root.removeAttribute("data-intro");
      };
      out = requestAnimationFrame(step);
    };

    const t0 = performance.now();
    let cued = false;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / TAKE);
      draw(frame(t));
      if (!cued && t >= CUE) {
        cued = true;
        through();
      }
      if (t < 1) raf = requestAnimationFrame(step);
    };
    draw(frame(0));
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(out);
    };
  }, []);

  return (
    <div id="jg-intro" ref={box} aria-hidden="true">
      <svg ref={art} viewBox="0 0 100 100" focusable="false">
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
