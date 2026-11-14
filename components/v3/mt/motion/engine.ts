/* v4 home motion engine (spec "Scroll method: Current"). One rAF loop for the
   whole home. On the desktop structure (D) every `[data-mt][data-hold]` section
   becomes a tall wrapper with a sticky stage (motion.css) and gets `--p`, 0 to 1
   through its hold. Sections without a hold get `--p` as they cross the screen.
   Drivers add the per-section motion; each owns one file in this folder. */

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
};

export type Driver = {
  /** the section's `data-mt` name */
  name: string;
  /** once, after the section is in the DOM. Return a cleanup. */
  setup?: (el: HTMLElement, ctx: Ctx) => void | (() => void);
  /** every frame while the section is within one screen of the viewport */
  frame?: (p: number, el: HTMLElement, ctx: Ctx) => void;
  /** run `frame` on every structure. Default: only when holds are on (D). */
  always?: boolean;
};

const D = "(min-width:1024px) and (min-height:600px)";
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (v: number) => v * v * (3 - 2 * v);
/** 0 to 1 as v goes from a to b, clamped */
export const span = (v: number, a: number, b: number) => clamp((v - a) / (b - a));

export function startEngine(root: HTMLElement, drivers: Driver[]) {
  const html = document.documentElement;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const mqD = matchMedia(D);
  const mqFine = matchMedia("(hover:hover) and (pointer:fine)");
  const ctx: Ctx = { vw: innerWidth, vh: innerHeight, y: scrollY, dy: 0, t: performance.now(), dt: 16, held: mqD.matches, fine: mqFine.matches, u: 1 };
  const secs = [...root.querySelectorAll<HTMLElement>("[data-mt]")];
  const last = new Map<HTMLElement, number>();
  const lastIn = new Map<HTMLElement, number>();
  const measure = () => {
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
  const offs = drivers.flatMap((d) => secs.filter((s) => s.dataset.mt === d.name).map((s) => d.setup?.(s, ctx)));
  let raf = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    ctx.dt = Math.min(50, now - ctx.t);
    ctx.t = now;
    ctx.dy = scrollY - ctx.y;
    ctx.y = scrollY;
    for (const s of secs) {
      const r = s.getBoundingClientRect();
      if (r.bottom < -ctx.vh || r.top > 2 * ctx.vh) continue;
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
      for (const d of drivers) if (d.frame && d.name === s.dataset.mt && (ctx.held || d.always)) d.frame(p, s, ctx);
    }
  };
  raf = requestAnimationFrame(tick);
  addEventListener("resize", measure);
  mqD.addEventListener("change", measure);
  return () => {
    cancelAnimationFrame(raf);
    removeEventListener("resize", measure);
    mqD.removeEventListener("change", measure);
    offs.forEach((off) => off?.());
    html.removeAttribute("data-mt-held");
    html.removeAttribute("data-mt-motion");
    for (const s of secs) (s.style.removeProperty("--p"), s.style.removeProperty("--in"));
  };
}
