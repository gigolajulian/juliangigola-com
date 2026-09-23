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
const TAKE = 1400; // the mark: open, hold, and close
const PART = 1100; // the lids carrying on off the screen
const SHUT = 0.78; // where in the take the lens is flat: the cut
const BLUR = 0.72; // how soft the mark starts, as a share of its own thickness
const FEATHER = 0.018; // how soft the lid edge is, as a share of the window
const PAGE = 0.026; // how soft the page starts, as a share of the window

const radius = (a: number, s: number) => (a * a + s * s) / (2 * Math.max(s, 0.18));

/** The lens, from a half width and the rise of each arc. */
function lens(a: number, top: number, bot: number) {
  const x0 = (50 - a).toFixed(3);
  const x1 = (50 + a).toFixed(3);
  const rt = radius(a, top).toFixed(3);
  const rb = radius(a, bot).toFixed(3);
  return `M${x0} ${CY} A${rt} ${rt} 0 0 1 ${x1} ${CY} A${rb} ${rb} 0 0 1 ${x0} ${CY} Z`;
}

/** The same lens, anywhere and at any size: the intro draws it in the
    mark's own hundred units while it is a logo, and in screen pixels once
    it is a hole in the page. One formula, so the swap between the two is
    the same shape at the same place. */
function wide(cx: number, cy: number, a: number, s: number) {
  const r = radius(a, s).toFixed(2);
  return `M${(cx - a).toFixed(2)} ${cy.toFixed(2)} A${r} ${r} 0 0 1 ${(cx + a).toFixed(2)} ${cy.toFixed(2)} A${r} ${r} 0 0 1 ${(cx - a).toFixed(2)} ${cy.toFixed(2)} Z`;
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

/* The focus lands as the iris finishes opening, on an ease-out, so most
   of the softness goes in the first third and the last of it settles
   rather than creeps. It has to reach zero well before the cut: blur
   still on the mark at the hairline would show at the swap, and the veil
   cannot be blurred with it, since a soft hole lets the page through
   early. */
const focus = (t: number) => 1 - Math.pow(1 - t, 3);

/* The lens grows outward along its own axis from a short line, so the
   shape arrives rather than being uncovered, and the iris opens from
   just under its drawn size: far enough to read as movement, not so far
   that it reads as a zoom. It rests on the artwork, and then it closes.
   The take ends shut, on a hairline, because that hairline is the cut. */
const frame = (t: number) => ({
  a: track(t, [[0, 14], [0.42, A]]),
  s: track(t, [[0, 1.2], [0.44, S], [0.58, S], [SHUT, 0.3]]),
  iris: track(t, [[0, 0.82], [0.48, 1]]),
  pupil: track(t, [[0, 0.78], [0.54, 1]]),
  blur: track(t, [[0, 1], [0.55, 0, focus]]),
});

/* Once per page load. React remounts effects in development, and a second
   take would measure a mark the first one had already hidden. */
let played = false;

export function Intro() {
  const box = React.useRef<HTMLDivElement>(null);
  const path = React.useRef<SVGPathElement>(null);
  const clip = React.useRef<SVGPathElement>(null);
  const iris = React.useRef<SVGGElement>(null);
  const eye = React.useRef<SVGGElement>(null);
  const dot = React.useRef<SVGCircleElement>(null);
  const veilRef = React.useRef<SVGSVGElement>(null);
  const holeRef = React.useRef<SVGPathElement>(null);
  const edgeRef = React.useRef<SVGFEGaussianBlurElement>(null);

  React.useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "1" || played) return;
    played = true;
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}

    const art = box.current?.querySelector("svg");
    const span = art?.getBoundingClientRect().width ?? 0;

    const draw = (f: ReturnType<typeof frame>) => {
      if (art) {
        /* Sized against the lens's own thickness, never a fixed number
           of pixels. The mark is set in `vw` between two clamps, so a
           blur that reads as a lens finding focus on a desktop is a
           smeared blob on a phone; and the take opens from a line three
           pixels tall, which a blur measured off the whole mark erases
           rather than softens. Held to the thickness, the softness
           arrives with the shape and leaves with it. */
        const px = f.blur * BLUR * f.s * 2 * (span / 100);
        (art as SVGSVGElement).style.filter =
          px > 0.2 ? `blur(${px.toFixed(2)}px)` : "";
      }
      const d = lens(f.a, f.s, f.s);
      path.current?.setAttribute("d", d);
      clip.current?.setAttribute("d", d);
      const scale = `scale(${f.iris})`;
      if (iris.current) iris.current.style.transform = scale;
      if (eye.current) eye.current.style.transform = scale;
      dot.current?.setAttribute("r", (8.6 * f.pupil).toFixed(3));
    };

    /* The ending, in two halves that are the same gesture.
     *
     * The cut: the take finishes inside the blink, on the frame where the
     * lens is flat and the screen holds one hairline of ink and nothing
     * else. A film cuts on motion because there is nothing to hide
     * behind; here there is nothing on screen to dissolve, so the mark
     * can stop being ink and start being a hole without anybody seeing
     * the swap. That is the whole trick, and it costs nothing.
     *
     * The parting: from that hairline the same two arcs carry on opening,
     * in screen units now, until the top one has left the top of the
     * window and the bottom one the bottom. The ground splits along the
     * logo's own curves and the site is what is between them. Nothing is
     * masked over the page, nothing scales, nothing fades: the shape
     * doing the transition is the mark itself.
     */
    const part = () => {
      const el = box.current;
      const art = el?.querySelector("svg");
      const veil = veilRef.current;
      const hole = holeRef.current;
      const edge = edgeRef.current;
      if (!el || !art || !veil || !hole || !edge) return;

      const m = art.getBoundingClientRect();
      const w = window.innerWidth;
      const h = window.innerHeight;
      // where the hairline is on screen, in screen units
      const cx = m.left + m.width / 2;
      const cy = m.top + (m.height * CY) / 100;
      const a0 = (m.width * A) / 100;
      const s0 = (m.height * 0.3) / 100;
      /* Wide enough that the lens's points sit off the sides, so what
         crosses the screen is two arcs and never a closing shape, and no
         wider: past about this the arcs flatten into straight edges and
         the reveal stops being the logo's curve and becomes a blind. */
      const a1 = w * 1.15;
      /* Just far enough that the arcs leave the window as the curve lands,
         rather than early with the rest of the take spent on an empty
         screen: the rise each one has to travel is its own distance to the
         edge, and the margin is for the flattest part of the curve near
         the corners. */
      const s1 = Math.max(cy, h - cy) * 1.08;
      /* Both softnesses are measured off the window, so the gesture reads
         the same on a phone as on a desktop. */
      const fur = Math.min(w, h) * FEATHER;
      const haze = Math.min(w, h) * PAGE;

      veil.setAttribute("viewBox", `0 0 ${w} ${h}`);
      hole.setAttribute("d", wide(cx, cy, a0, s0));
      el.classList.add("jg-intro-parting");
      /* The page is only worth blurring from here. Until the cut it is
         behind a solid ground, and a filter over the whole site costs a
         layer the size of the window for nothing. */
      root.classList.add("jg-intro-focusing");
      root.style.setProperty("--jg-focus", `${haze.toFixed(2)}px`);

      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / PART);
        /* The line runs out to the sides first, so what is left travelling
           is two arcs and not a closing shape. The arcs themselves part on
           the same eased curve the blink used, from a standstill, because
           the blink arrived at this hairline decelerating: any faster off
           the mark and the ground is gone before the eye has read it as
           lids. */
        const a = mix(a0, a1, 1 - Math.pow(1 - Math.min(1, t / 0.45), 3));
        const s = mix(s0, s1, glide(t));
        hole.setAttribute("d", wide(cx, cy, a, s));
        /* Held to the gap's own rise for the same reason the mark's blur
           was: a feather wider than the opening erases the opening. Once
           the lids are a window apart it settles at its full width and
           the edge stays soft all the way off the screen. */
        edge.setAttribute("stdDeviation", Math.min(fur, s * 0.5).toFixed(2));
        /* The page comes into focus on the lids' own curve, so the
           softness leaves at the rate they open rather than waiting for
           them and sharpening afterwards, which reads as a second
           animation after the first has finished. It lands on zero at
           the same moment they clear the window, and the curve is
           decelerating there, so nothing snaps. */
        root.style.setProperty(
          "--jg-focus",
          `${(haze * (1 - glide(t))).toFixed(2)}px`,
        );
        if (t < 1) requestAnimationFrame(step);
        else {
          root.removeAttribute("data-intro");
          root.classList.remove("jg-intro-focusing");
          root.style.removeProperty("--jg-focus");
        }
      };
      requestAnimationFrame(step);
    };

    const t0 = performance.now();
    let cut = false;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / (TAKE * SHUT));
      draw(frame(t * SHUT));
      if (t < 1) requestAnimationFrame(step);
      else if (!cut) {
        cut = true;
        part();
      }
    };
    draw(frame(0));
    requestAnimationFrame(step);
    /* No cleanup. The take is a one-shot that ends on its own inside two
       seconds, and cancelling it on unmount would stop it dead in
       development, where React mounts an effect twice and the guard above
       keeps the second mount from starting it again. */
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

      {/* The ground again, with the lens cut out of it. It is the same
          colour as the layer it sits on and its hole starts as the
          hairline the mark ended on, so switching to it is invisible;
          from there the hole is the only thing that moves. */}
      <svg
        ref={veilRef}
        className="jg-intro-veil"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          {/* The lid edge. Blurring the hole rather than the veil keeps
              the softness on the one edge that moves: blurring the veil
              would soften the window's own borders too and let the page
              through at the corners. `sRGB` because a mask blurred in
              linear light lifts its midtones and the edge reads as a
              grey band rather than a fade. */}
          <filter
            id="jg-intro-feather"
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur ref={edgeRef} stdDeviation="0" />
          </filter>
          <mask id="jg-intro-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            <path ref={holeRef} fill="#000" filter="url(#jg-intro-feather)" />
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="var(--background)"
          mask="url(#jg-intro-mask)"
        />
      </svg>
    </div>
  );
}
