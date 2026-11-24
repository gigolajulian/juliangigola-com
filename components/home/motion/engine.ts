/* v4 home motion engine (spec "Scroll method: Current"). One rAF loop for the
   whole home. On the desktop structure (D, `held` in lib/device.ts) every `[data-mt][data-hold]` section
   becomes a tall wrapper with a sticky stage (motion.css) and gets `--p`, 0 to 1
   through its hold. Sections without a hold get `--p` as they cross the screen.
   Drivers add the per-section motion and are keyed by the section's `data-mt` name. Most files drive one section;
   depth.ts adds a second hero driver and bars.ts drives book and quote. */

import { matches, media } from "@/lib/device";
import { touchParity } from "./touch-parity";

export type Ctx = {
  // Liveness, for listeners in a setup closure that read ctx outside frame:
  // vw, vh, held, fine, u: written by measure() on resize and on the held media change, so they are current
  // (and on the fine query's own change).
  // y, dy, t, dt, fresh: written once per tick, so outside frame they hold the last frame's values.
  // top, h: overwritten for each section in the tick, valid only inside that section's frame.
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

/** Every `data-mt` section name in components/home. */
export type HomeSection = "hero" | "covers" | "motion" | "comm" | "about" | "quote" | "foot" | "book";

/** every frame while the section is within one screen of the viewport (it carries `data-mt-near` then) */
export type Frame = (p: number, el: HTMLElement, ctx: Ctx) => void;

export type Driver = {
  /** the section's `data-mt` name */
  name: HomeSection;
  /** once per section, after it is in the DOM. Returns a cleanup, or the section's frame and cleanup, so state lives in the closure. */
  setup?: (el: HTMLElement, ctx: Ctx) => void | (() => void) | { frame?: Frame; off?: () => void };
  /** run `frame` on every structure. Default: only when holds are on (D). */
  always?: boolean;
};

/** A title or name line coming up from under its clip (Cover art, Motion, Commissions). */
const RISE: KeyframeAnimationOptions = { duration: 600, easing: "cubic-bezier(.16,1,.3,1)" };
export const rise = (n: Element | null | undefined) => n?.animate([{ transform: "translateY(110%)" }, { transform: "none" }], RISE);
/** Hands a section's React screen what to show (by-quote.tsx and commissions.tsx read it with `useTold`, ctx.ts).
    `now`: React commits it before this returns, so the change lands in this frame, as a direct DOM write would. */
export const tell = (el: HTMLElement, detail: object, now = true) => el.dispatchEvent(new CustomEvent("mt-tell", { detail: { ...detail, now } }));
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (v: number) => v * v * (3 - 2 * v);
/** 0 to 1 as v goes from a to b, clamped */
export const progressBetween = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
/** A section's `--p`, 0 to 1. Held: through its hold, as its top edge travels the height it has beyond one screen.
   Not held: as it crosses the screen, from its top edge at the bottom of the screen to its bottom edge at the top. */
export const progress = (top: number, h: number, vh: number, hold: boolean) =>
  hold ? clamp(-top / Math.max(1, h - vh)) : clamp((vh - top) / (h + vh));


const DESIGN_W = 1440; // the design frame `u` scales from
const DESIGN_H = 900;
const REBOX_MS = 1000; // while the page scrolls, the section boxes are measured again at most this often, as a net

/** The engine's state: the sections with their cached boxes and last written values, and the loop's own timers. */
type Engine = {
  ctx: Ctx;
  html: HTMLElement;
  secs: HTMLElement[];
  mqD: MediaQueryList;
  mqFine: MediaQueryList;
  // Section boxes in page coordinates. Measured when something can have moved them, never per frame:
  // a resize, a section or the home changing height, and once a second while the page scrolls as a net.
  boxes: Map<HTMLElement, { top: number; h: number }>;
  near: Map<HTMLElement, boolean>;
  last: Map<HTMLElement, number>;
  lastIn: Map<HTMLElement, number>;
  lastOut: Map<HTMLElement, number>;
  // per section, its drivers' frames in array order (hero.ts, then depth.ts for the hero)
  runs: Map<HTMLElement, { f: Frame; always?: boolean }[]>;
  stale: boolean;
  boxedAt: number;
  raf: number;
  moved: number;
};

function boxAll(e: Engine) {
  const y = scrollY;
  for (const s of e.secs) {
    const r = s.getBoundingClientRect();
    e.boxes.set(s, { top: r.top + y, h: r.height });
  }
}

function measureCtx(e: Engine) {
  const { ctx, html } = e;
  e.stale = true;
  ctx.vw = innerWidth;
  ctx.vh = innerHeight;
  ctx.held = e.mqD.matches;
  ctx.fine = e.mqFine.matches;
  ctx.u = clamp(Math.min(ctx.vw / DESIGN_W, ctx.vh / DESIGN_H), 0.7, 1.6);
  html.toggleAttribute("data-mt-held", ctx.held);
  for (const s of e.secs) if (s.dataset.hold) s.style.setProperty("--hold", s.dataset.hold);
}

function setupDrivers(e: Engine, drivers: Driver[], offs: (void | (() => void))[]) {
  for (const d of drivers)
    for (const s of e.secs) {
      if (s.dataset.mt !== d.name) continue;
      const r = d.setup?.(s, e.ctx);
      offs.push(typeof r === "function" ? r : r?.off);
      const f = r && typeof r === "object" ? r.frame : undefined;
      if (f) e.runs.set(s, [...(e.runs.get(s) ?? []), { f, always: d.always }]);
    }
}

/** One section's frame: its `--p`, `--in` and `--out`, then its drivers. Off screen by more than a screen, only `data-mt-near` changes. */
function frameSection(e: Engine, s: HTMLElement) {
  const { ctx } = e;
  const b = e.boxes.get(s)!;
  const r = { top: b.top - ctx.y, bottom: b.top - ctx.y + b.h, height: b.h };
  const on = !(r.bottom < -ctx.vh || r.top > 2 * ctx.vh);
  // layers (will-change in the motion css) only for sections near the screen
  if (e.near.get(s) !== on) { e.near.set(s, on); s.toggleAttribute("data-mt-near", on); }
  if (!on) return;
  ctx.top = r.top;
  ctx.h = r.height;
  const hold = ctx.held && !!s.dataset.hold;
  const p = progress(r.top, r.height, ctx.vh, hold);
  if (Math.abs((e.last.get(s) ?? -1) - p) > 0.0004) {
    e.last.set(s, p);
    s.style.setProperty("--p", p.toFixed(4));
  }
  const enter = clamp((ctx.vh - r.top) / ctx.vh);
  if (Math.abs((e.lastIn.get(s) ?? -1) - enter) > 0.002) {
    e.lastIn.set(s, enter);
    s.style.setProperty("--in", enter.toFixed(3));
  }
  const leave = clamp((ctx.vh - r.bottom) / ctx.vh);
  if (Math.abs((e.lastOut.get(s) ?? -1) - leave) > 0.002) {
    e.lastOut.set(s, leave);
    s.style.setProperty("--out", leave.toFixed(3));
  }
  for (const x of e.runs.get(s) ?? []) if (ctx.held || x.always) x.f(p, s, ctx);
}

function step(e: Engine, now: number) {
  const { ctx, html } = e;
  ctx.dt = Math.min(50, now - ctx.t);
  ctx.t = now;
  ctx.dy = scrollY - ctx.y;
  // while the page moves, things passing under a resting pointer must not light up as hovered
  if (ctx.dy) e.moved = now;
  html.toggleAttribute("data-mt-scrolling", now - e.moved < 180);
  ctx.y = scrollY;
  ctx.fresh = e.stale || (ctx.dy !== 0 && now - e.boxedAt > REBOX_MS);
  if (ctx.fresh) {
    e.stale = false;
    e.boxedAt = now;
    boxAll(e);
  }
  for (const s of e.secs) frameSection(e, s);
}

function stopEngine(e: Engine, measure: () => void, ro: ResizeObserver, offs: (void | (() => void))[], tpOff: () => void) {
  const { html } = e;
  cancelAnimationFrame(e.raf);
  ro.disconnect();
  removeEventListener("resize", measure);
  e.mqD.removeEventListener("change", measure);
  e.mqFine.removeEventListener("change", measure);
  offs.forEach((off) => off?.());
  html.removeAttribute("data-mt-held");
  html.removeAttribute("data-mt-motion");
  tpOff();
  html.removeAttribute("data-mt-scrolling");
  for (const s of e.secs) { s.style.removeProperty("--p"); s.style.removeProperty("--in"); s.style.removeProperty("--out"); s.removeAttribute("data-mt-near"); }
}

export function startEngine(root: HTMLElement, drivers: Driver[]) {
  const html = document.documentElement;
  if (matches("calm")) return () => {};
  const mqD = media("held");
  const mqFine = media("fine");
  const ctx: Ctx = { vw: innerWidth, vh: innerHeight, y: scrollY, dy: 0, t: performance.now(), dt: 16, held: mqD.matches, fine: mqFine.matches, u: 1, top: 0, h: 0, fresh: true };
  const secs = [...root.querySelectorAll<HTMLElement>("[data-mt]")];
  const e: Engine = { ctx, html, secs, mqD, mqFine, boxes: new Map(), near: new Map(), last: new Map(), lastIn: new Map(), lastOut: new Map(), runs: new Map(), stale: true, boxedAt: 0, raf: 0, moved: -1e9 };
  const ro = new ResizeObserver(() => (e.stale = true));
  ro.observe(root);
  for (const s of secs) ro.observe(s);
  const measure = () => measureCtx(e);
  measure();
  // the engine's own listeners go in before the drivers', so a driver's resize handler reads a measured ctx
  addEventListener("resize", measure);
  mqD.addEventListener("change", measure);
  mqFine.addEventListener("change", measure);
  html.setAttribute("data-mt-motion", "");
  const tpOff = touchParity();
  const offs: (void | (() => void))[] = [];
  setupDrivers(e, drivers, offs);
  const tick = (now: number) => {
    e.raf = requestAnimationFrame(tick);
    step(e, now);
  };
  e.raf = requestAnimationFrame(tick);
  return () => stopEngine(e, measure, ro, offs, tpOff);
}
