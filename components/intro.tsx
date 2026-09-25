"use client";

import * as React from "react";
import { CrtBackground } from "@designcodeio/threeui";

/* ── the opening ──────────────────────────────────────────────────
 * The eye mark in the middle of a CRT playing a film leader (ThreeUI's
 * `CrtBackground`, cinematic), where the countdown's number would be: it
 * fades in while a loader under it fills with the page getting ready. It
 * blinks at 65, and at 100 the layer fades to the site.
 *
 * Three rules it lives by, because an intro sits between a visitor and
 * the work:
 *
 *   It never holds the page for long. The site is rendered underneath
 *   from the first byte, and the layer gives up at `CAP` whatever is
 *   still loading: a slow phone is not kept at the door for the last
 *   photograph.
 *
 *   It runs once a visit, not once a page. `sessionStorage` remembers,
 *   so moving between Work and Sessions never replays it.
 *
 *   It is skipped for anybody who asks their system for less motion.
 *
 * All three decisions are made by the inline script in `layout.tsx`
 * before the first paint, which is the only place they can be made
 * without a frame of the site showing first. The stylesheet keeps this
 * layer hidden unless that script has set `data-intro`, so a visitor
 * with no JavaScript is never shut behind a curtain that cannot lift.
 * ─────────────────────────────────────────────────────────────── */

const CAP = 5000; // the longest anybody waits, whatever is still loading
const SHOW = 500; // the eye fading in
const FILL = 1000; // the loader's steady fill, when the page is quicker
const BLINK = 360; // the blink at 65: shut, then open again
const HIDE = 300; // the eye fading out, before the page starts
const LIFT = 400; // the ground fading while the page arrives

/* The leader's dial, as the package draws it: the screen letterboxed by
   0.112 of its height top and bottom, and the dial a radius of 0.325 of
   what is left. The screen fills the window, so in CSS pixels the dial's
   radius is this share of the window's height. */
const DIAL = 0.325 * (1 - 2 * 0.112);
const DISC = 0.8; // the patch over the countdown's number, in dial radii
const EYE = 1.35; // the eye's width, in dial radii
const LINE = 2.5; // the CRT's scanline pitch, CSS pixels: 0.4 a pixel of height

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* The logo from `app/icon.svg`: the lens with the iris taken out of it,
   and the pupil. The iris is bigger than the lens is tall, so the cut
   runs off the top and the lens reads as a cup. */
// Made on first use: there is no `Path2D` on the server.
let shape: { lens: Path2D; open: Path2D; pupil: Path2D } | null = null;
function paths() {
  if (shape) return shape;
  const lens = new Path2D(
    "M7.2 49.6 A59.9 59.9 0 0 1 92.8 49.6 A59.9 59.9 0 0 1 7.2 49.6 Z",
  );
  const open = new Path2D("M-1e3 -1e3 H1e3 V1e3 H-1e3 Z");
  open.arc(50, 40.9, 20.7, 0, Math.PI * 2);
  const pupil = new Path2D();
  pupil.arc(50, 40.9, 8.6, 0, Math.PI * 2);
  return (shape = { lens, open, pupil });
}

/* The eye on the leader, where the countdown's number is. A patch of the
   screen's own dark covers the number, feathered so its edge is lost in
   the glass, and the eye goes on it in the leader's white with the
   number's glow. Then the picture's faults, over what is drawn and
   nowhere else: the scanlines at the CRT's pitch, a grain that changes
   every frame, and now and then the eye knocked sideways or a row of it
   torn.

   `open` is how far the lid is up: one is the logo as drawn, nought a
   line through the lens's middle. `px` is canvas pixels to a CSS pixel. */
function draw(
  c: CanvasRenderingContext2D,
  grain: HTMLCanvasElement,
  eye: number,
  open: number,
  px: number,
) {
  const { width: w, height: h } = c.canvas;
  const cx = w / 2;
  const cy = h / 2;
  const { lens, open: cut, pupil } = paths();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
  c.clearRect(0, 0, w, h);

  const disc = c.createRadialGradient(cx, cy, 0, cx, cy, w / 2);
  disc.addColorStop(0.86, "rgb(10,10,12)");
  disc.addColorStop(1, "rgba(10,10,12,0)");
  c.fillStyle = disc;
  c.fillRect(0, 0, w, h);

  const k = eye / 85.6; // pixels per logo unit: the lens is 85.6 wide
  const nudge = Math.random() < 0.08 ? (Math.random() - 0.5) * 4 * px : 0;
  c.setTransform(k, 0, 0, k * open, cx - 50 * k + nudge, cy - 49.6 * k * open);
  c.fillStyle = "#f6f6fa";
  c.shadowColor = "rgba(255,255,255,0.55)";
  c.shadowBlur = eye * 0.09;
  c.save();
  c.clip(lens);
  c.fill(cut, "evenodd");
  c.restore();
  c.fill(pupil);
  c.shadowBlur = 0;

  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-atop";
  c.globalAlpha = 0.16;
  c.fillStyle = "#000";
  const pitch = LINE * px;
  for (let y = cy % pitch; y < h; y += pitch) {
    c.fillRect(0, y, w, pitch * 0.45);
  }
  const g = grain.getContext("2d");
  if (g) {
    const img = g.createImageData(grain.width, grain.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    c.globalAlpha = 0.11;
    c.imageSmoothingEnabled = false;
    c.drawImage(grain, 0, 0, w, h);
  }
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 1;
  if (Math.random() < 0.12) {
    const y = Math.random() * h;
    const band = (2 + Math.random() * 6) * px;
    const dx = (Math.random() - 0.5) * 10 * px;
    c.drawImage(c.canvas, 0, y, w, band, dx, y, w, band);
  }
}

/* Whether this browser can draw the CRT at all: without WebGL the
   package throws while mounting, and the eye plays on the plain ground. */
function webgl() {
  try {
    return !!document.createElement("canvas").getContext("webgl");
  } catch {
    return false;
  }
}

const lift = () => document.documentElement.removeAttribute("data-intro");

/* Once per page load. React remounts effects in development, and a second
   take would start a loader the first had already finished. */
let played = false;

export function Intro() {
  const box = React.useRef<HTMLDivElement>(null);
  const mark = React.useRef<HTMLDivElement>(null);
  const eyeBox = React.useRef<HTMLDivElement>(null);
  const bar = React.useRef<HTMLDivElement>(null);
  const count = React.useRef<HTMLSpanElement>(null);
  /* The CRT, mounted only while the intro plays: WebGL on every page load
     for a layer that is not showing would be waste. */
  const [crt, setCrt] = React.useState(false);

  React.useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "1" || played) return;
    played = true;
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}

    /* The eye sits in the dial, and the dial is sized by the window's
       height. The patch it sits on is its canvas. */
    const dial = DIAL * window.innerHeight;
    const full = EYE * dial;
    const side = 2 * DISC * dial;
    // For the loader, which sits under the eye.
    box.current?.style.setProperty("--eye", `${full}px`);

    /* Drawn at the screen's own pixels, up to two to a CSS pixel, so the
       eye's edges are sharp on a retina screen. */
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.round(side * dpr);
    canvas.style.cssText = `display:block;width:${side}px;height:${side}px`;
    eyeBox.current?.append(canvas);
    const pen = canvas.getContext("2d");
    // The grain: a small tile of noise, stretched over the eye.
    const grain = document.createElement("canvas");
    grain.width = grain.height = Math.max(32, Math.round(side / 2));
    const withCrt = webgl();

    /* What "ready" means: the type, every photograph already on screen
       that is not lazy, and the window's own load. The line fills on a
       steady curve over `FILL` and never runs ahead of those: a quick page
       gets the smooth fill, a slow one waits at what has really come. */
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

    const t0 = performance.now();
    let shown = 0;
    let blinkAt = 0;
    let crtOn = false;
    const step = (now: number) => {
      if (withCrt && !crtOn) {
        crtOn = true;
        setCrt(true);
      }
      // A frame's time can be a touch before `t0`: never below nought.
      const since = Math.max(0, now - t0);
      const real = done / tasks.length;
      const target =
        since >= CAP ? 1 : Math.min(real, Math.min(1, since / FILL));
      shown += (target - shown) * 0.2;
      if (target - shown < 0.001) shown = target;

      /* At 65 it blinks: the lid comes down quicker than it goes back
         up, as a real one does. */
      if (shown >= 0.65 && blinkAt === 0) blinkAt = now;
      const b = blinkAt ? Math.min(1, (now - blinkAt) / BLINK) : 0;
      const shut =
        b < 0.4 ? easeInOut(b / 0.4) : 1 - easeInOut((b - 0.4) / 0.6);

      if (mark.current)
        mark.current.style.opacity = String(
          easeOut(Math.min(1, since / SHOW)),
        );
      if (pen) draw(pen, grain, full * dpr, 1 - 0.97 * shut, dpr);

      const gone = shown === 1 && b === 1;
      if (bar.current) bar.current.style.transform = `scaleX(${shown})`;
      if (count.current) {
        count.current.textContent = String(Math.round(shown * 100)).padStart(
          3,
          "0",
        );
      }
      if (!gone) {
        requestAnimationFrame(step);
        return;
      }
      box.current?.classList.add("jg-intro-leaving");
      setTimeout(() => {
        root.dataset.intro = "lift";
        setTimeout(() => {
          lift();
          canvas.remove();
          setCrt(false);
        }, LIFT);
      }, HIDE);
    };
    requestAnimationFrame(step);
    /* No cleanup. The loader is a one-shot that ends on its own inside
       `CAP`, and cancelling it on unmount would stop it dead in
       development, where React mounts an effect twice and the guard above
       keeps the second mount from starting it again. */
  }, []);

  return (
    <>
      {/* The one rule that cannot wait for the stylesheet. The layer is in
          the server's HTML and the styles are in separate files, so there
          is a window between the document arriving and the CSS applying
          in which it has no rules at all and would lay itself out in the
          flow. Carried inline it is there from the first byte, and
          `[data-intro] #jg-intro` in the stylesheet still wins on
          specificity when it comes.

          The attribute `hidden` would be shorter and is wrong: the user
          agent writes that rule with `!important`, which no author rule
          can beat, and the opening never plays at all. */}
      <style>{"#jg-intro{display:none}"}</style>
      <div id="jg-intro" ref={box} aria-hidden="true">
        <div ref={mark} className="jg-intro-mark">
          {crt && (
            <CrtBackground
              variant="cinematic"
              speed={1.31}
              motion={0.15}
              hue={7}
              saturation={1}
              brightness={1}
              opacity={1}
            />
          )}
          <div ref={eyeBox} className="jg-intro-eye" />
        </div>
        <div className="jg-intro-load">
          <span ref={count} className="label tabular-nums">
            000
          </span>
          <div className="jg-intro-track">
            <div ref={bar} />
          </div>
        </div>
      </div>
    </>
  );
}
