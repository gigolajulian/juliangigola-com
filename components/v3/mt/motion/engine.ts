/* v4 home motion engine (spec "Scroll method: Current"). One rAF loop for the
   whole home. On the desktop structure (D, `held` in lib/device.ts) every `[data-mt][data-hold]` section
   becomes a tall wrapper with a sticky stage (motion.css) and gets `--p`, 0 to 1
   through its hold. Sections without a hold get `--p` as they cross the screen.
   Drivers add the per-section motion; each owns one file in this folder. */

import { matches, media } from "@/lib/device";
import { touchParity } from "./touch-parity";

export type Ctx = {
  /** viewport width and height, px */
  vw: number;
  vh: number;
  /** page scroll, px, and its change since the last frame */
  y: number;
  dy: number;
  /** time, ms, and time since the last frame (capped at 50) */
  t: number;
  dt: number;
  /** D: desktop structure, holds are on. Otherwise the page scrolls naturally. */
  held: boolean;
  /** a mouse or trackpad: hover effects allowed */
  fine: boolean;
  /** design unit in px (the `--u` of mtscroll.css on D) */
  u: number;
  /** the section being framed: its top edge on screen and its height, px. Drivers read these, not the layout. */
  top: number;
  h: number;
  /** true on the frames where the section boxes were measured again (first frame, resize, a section changed height) */
  fresh: boolean;
};

export type Driver = {
  /** the section's `data-mt` name */
  name: string;
  /** once, after the section is in the DOM. Return a cleanup. */
  setup?: (el: HTMLElement, ctx: Ctx) => void | (() => void);
  /** every frame while the section is within one screen of the viewport (it carries `data-mt-near` then) */
  frame?: (p: number, el: HTMLElement, ctx: Ctx) => void;
  /** run `frame` on every structure. Default: only when holds are on (D). */
  always?: boolean;
};

/** A title or name line coming up from under its clip (Cover art, Motion, Commissions). */
export const RISE: KeyframeAnimationOptions = { duration: 600, easing: "cubic-bezier(.16,1,.3,1)" };
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (v: number) => v * v * (3 - 2 * v);
/** 0 to 1 as v goes from a to b, clamped */
export const span = (v: number, a: number, b: number) => clamp((v - a) / (b - a));

export function startEngine(root: HTMLElement, drivers: Driver[]) {
  const html = document.documentElement;
  if (matches("calm")) return () => {};
  const mqD = media("held");
  const mqFine = media("fine");
  const ctx: Ctx = { vw: innerWidth, vh: innerHeight, y: scrollY, dy: 0, t: performance.now(), dt: 16, held: mqD.matches, fine: mqFine.matches, u: 1, top: 0, h: 0, fresh: true };
  const secs = [...root.querySelectorAll<HTMLElement>("[data-mt]")];
  const last = new Map<HTMLElement, number>();
  const lastIn = new Map<HTMLElement, number>();
  const lastOut = new Map<HTMLElement, number>();
  // Section boxes in page coordinates. Measured when something can have moved them, never per frame:
  // a resize, a section or the home changing height, and once a second while the page scrolls as a net.
  const boxes = new Map<HTMLElement, { top: number; h: number }>();
  const near = new Map<HTMLElement, boolean>();
  let stale = true;
  let boxedAt = 0;
  const box = () => {
    const y = scrollY;
    for (const s of secs) {
      const r = s.getBoundingClientRect();
      boxes.set(s, { top: r.top + y, h: r.height });
    }
  };
  const ro = new ResizeObserver(() => (stale = true));
  ro.observe(root);
  for (const s of secs) ro.observe(s);
  const measure = () => {
    stale = true;
    ctx.vw = innerWidth;
    ctx.vh = innerHeight;
    ctx.held = mqD.matches;
    ctx.fine = mqFine.matches;
    ctx.u = clamp(Math.min(ctx.vw / 1440, ctx.vh / 900), 0.7, 1.6);
    html.toggleAttribute("data-mt-held", ctx.held);
    for (const s of secs) if (s.dataset.hold) s.style.setProperty("--hold", s.dataset.hold);
  };
  measure();
  html.setAttribute("data-mt-motion", "");
  const tpOff = touchParity();
  const offs = drivers.flatMap((d) => secs.filter((s) => s.dataset.mt === d.name).map((s) => d.setup?.(s, ctx)));
  let raf = 0;
  let moved = -1e9;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    ctx.dt = Math.min(50, now - ctx.t);
    ctx.t = now;
    ctx.dy = scrollY - ctx.y;
    // while the page moves, things passing under a resting pointer must not light up as hovered
    if (ctx.dy) moved = now;
    html.toggleAttribute("data-mt-scrolling", now - moved < 180);
    ctx.y = scrollY;
    ctx.fresh = stale || (ctx.dy !== 0 && now - boxedAt > 1000);
    if (ctx.fresh) {
      stale = false;
      boxedAt = now;
      box();
    }
    for (const s of secs) {
      const b = boxes.get(s)!;
      const r = { top: b.top - ctx.y, bottom: b.top - ctx.y + b.h, height: b.h };
      const on = !(r.bottom < -ctx.vh || r.top > 2 * ctx.vh);
      // layers (will-change in the motion css) only for sections near the screen
      if (near.get(s) !== on) { near.set(s, on); s.toggleAttribute("data-mt-near", on); }
      if (!on) continue;
      ctx.top = r.top;
      ctx.h = r.height;
      const hold = ctx.held && !!s.dataset.hold;
      const p = hold ? clamp(-r.top / Math.max(1, r.height - ctx.vh)) : clamp((ctx.vh - r.top) / (r.height + ctx.vh));
      if (Math.abs((last.get(s) ?? -1) - p) > 0.0004) {
        last.set(s, p);
        s.style.setProperty("--p", p.toFixed(4));
      }
      const enter = clamp((ctx.vh - r.top) / ctx.vh);
      if (Math.abs((lastIn.get(s) ?? -1) - enter) > 0.002) {
        lastIn.set(s, enter);
        s.style.setProperty("--in", enter.toFixed(3));
      }
      const leave = clamp((ctx.vh - r.bottom) / ctx.vh);
      if (Math.abs((lastOut.get(s) ?? -1) - leave) > 0.002) {
        lastOut.set(s, leave);
        s.style.setProperty("--out", leave.toFixed(3));
      }
      for (const d of drivers) if (d.frame && d.name === s.dataset.mt && (ctx.held || d.always)) d.frame(p, s, ctx);
    }
  };
  raf = requestAnimationFrame(tick);
  addEventListener("resize", measure);
  mqD.addEventListener("change", measure);
  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    removeEventListener("resize", measure);
    mqD.removeEventListener("change", measure);
    offs.forEach((off) => off?.());
    html.removeAttribute("data-mt-held");
    html.removeAttribute("data-mt-motion");
    tpOff();
    html.removeAttribute("data-mt-scrolling");
    for (const s of secs) { s.style.removeProperty("--p"); s.style.removeProperty("--in"); s.style.removeProperty("--out"); s.removeAttribute("data-mt-near"); }
  };
}
