"use client";

import * as React from "react";

/* ── the opening ──────────────────────────────────────────────────
 * The eye mark in the middle of the window: it fades in while a loader
 * under it fills with the page getting ready. It blinks at 65, and at
 * 100 the layer fades to the site.
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
const BLINK = 360; // the blink at 100: shut, then open again
const HIDE = 300; // the eye fading out, before the page starts
const LIFT = 400; // the ground fading while the page arrives

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

/* The eye, flat, in the page's own colours. `open` is how far the lid
   is up: one is the logo as drawn, nought a line through the lens's
   middle. */
type RGB = [number, number, number];
function draw(
  c: CanvasRenderingContext2D,
  ground: RGB,
  ink: RGB,
  eye: number,
  open: number,
  // Where its middle is, in the canvas's own pixels.
  cx: number,
  cy: number,
) {
  const { width: w, height: h } = c.canvas;
  const { lens, open: cut, pupil } = paths();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = `rgb(${ground.join(",")})`;
  c.fillRect(0, 0, w, h);
  const k = eye / 85.6; // pixels per logo unit: the lens is 85.6 wide
  c.setTransform(k, 0, 0, k * open, cx - 50 * k, cy - 49.6 * k * open);
  c.fillStyle = `rgb(${ink.join(",")})`;
  c.save();
  c.clip(lens);
  c.fill(cut, "evenodd");
  c.restore();
  c.fill(pupil);
}

/* A colour as red, green and blue, from whatever the theme declares it
   in: the canvas resolves `oklch()` and the rest for us. */
function resolve(css: string): RGB {
  const c = document.createElement("canvas").getContext("2d");
  if (!c) return [0, 0, 0];
  c.fillStyle = css;
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

const lift = () => document.documentElement.removeAttribute("data-intro");

/* Once per page load. React remounts effects in development, and a second
   take would start a loader the first had already finished. */
let played = false;

export function Intro() {
  const box = React.useRef<HTMLDivElement>(null);
  const mark = React.useRef<HTMLDivElement>(null);
  const bar = React.useRef<HTMLDivElement>(null);
  const count = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.intro !== "1" || played) return;
    played = true;
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}

    const cs = getComputedStyle(root);
    const ground = resolve(cs.getPropertyValue("--background").trim());
    const ink = resolve(cs.getPropertyValue("--foreground").trim());

    /* The eye is about 1.6 times the still logo on a desktop and half the
       width of a phone, and never more than half the window's height. */
    const rem = parseFloat(cs.fontSize) || 16;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const full = Math.min(
      Math.max(0.28 * w, Math.min(0.55 * w, 16 * rem)),
      24 * rem,
      0.5 * h,
    );
    // For the loader, which sits under the eye.
    box.current?.style.setProperty("--eye", `${full}px`);

    /* Drawn at the screen's own pixels, up to two to a CSS pixel, so the
       eye's edges are sharp on a retina screen. */
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.cssText = "display:block;width:100%;height:100%";
    mark.current?.append(canvas);
    const pen = canvas.getContext("2d");

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
    const step = (now: number) => {
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

      canvas.style.opacity = String(easeOut(Math.min(1, since / SHOW)));
      if (pen)
        draw(
          pen,
          ground,
          ink,
          full * dpr,
          1 - 0.97 * shut,
          (w / 2) * dpr,
          (h / 2) * dpr,
        );

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
        <div ref={mark} className="jg-intro-mark" />
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
