import { clamp, smooth, span, type Driver } from "./engine";

/* Hero wall travel (spec 3.2). Held (D): the wall travels up through the hold,
   each column trailing by its lag A, and the name block leaves once at the end.
   Not held: the page scrolls the wall itself and the columns only drift. */

const WALL = 2640; // wall height, design px (mtscroll.css)
const TAIL = 160; // ground left under the last row when the travel ends: 1900 at 1440x900
const LAG_MAX = 2400;
const DRIFT = [40, 22]; // phone drift caps, px, per column

type Part = { el: HTMLElement; a: number; c: number; v: number };
type State = { cols: Part[]; figs: Part[]; name: HTMLElement | null; s: number; mode: string; e: number };
const states = new WeakMap<HTMLElement, State>();

const move = (p: Part, y: number) => {
  const v = Math.round(y * 10) / 10;
  if (v === p.v) return;
  p.v = v;
  p.el.style.transform = v ? `translate3d(0,${v}px,0)` : "";
};

export const heroDrivers: Driver[] = [
  {
    name: "hero",
    always: true,
    setup(el) {
      const part = (n: HTMLElement, a: number, c: number): Part => ({ el: n, a, c, v: 0 });
      const st: State = {
        cols: [...el.querySelectorAll<HTMLElement>(".mt-col")].map((n) => part(n, Number(n.dataset.a) || 0, 0)),
        figs: [...el.querySelectorAll<HTMLElement>(".mt-col:not(.side) figure")].map((n) => part(n, 0, Number(n.style.getPropertyValue("--c2")) || 0)),
        name: el.querySelector<HTMLElement>("[data-mt-name]"),
        s: -1,
        mode: "",
        e: -1,
      };
      states.set(el, st);
      return () => {
        [...st.cols, ...st.figs].forEach((p) => (p.el.style.transform = ""));
        if (st.name) st.name.style.cssText = "";
      };
    },
    frame(p, el, ctx) {
      const st = states.get(el);
      if (!st) return;
      const mode = ctx.held ? "d" : ctx.vw < 600 ? "p" : "t";
      if (mode !== st.mode) {
        st.mode = mode;
        st.s = -1;
        st.e = -1;
        [...st.cols, ...st.figs].forEach((x) => move(x, 0));
        if (st.name) st.name.style.cssText = "";
      }

      if (mode === "d") {
        const u = ctx.u;
        const target = p * Math.max(0, (WALL + TAIL) * u - Math.max(ctx.vh, 600));
        // the 0.2 follow of the live Recent(), frame-rate independent
        st.s = st.s < 0 || Math.abs(target - st.s) < 0.1 ? target : st.s + (target - st.s) * (1 - Math.pow(0.8, ctx.dt / 16.7));
        const S = st.s;
        for (const c of st.cols) move(c, -(S - Math.min(S, LAG_MAX * u) * c.a * 0.5));
        const e = Math.round(smooth(span(p, 0.76, 0.96)) * 1000) / 1000;
        if (st.name && e !== st.e) {
          st.e = e;
          st.name.style.opacity = String(1 - e);
          st.name.style.transform = e ? `translate3d(0,${(-56 * u * e).toFixed(1)}px,0)` : "";
          st.name.style.visibility = e >= 1 ? "hidden" : ""; // gone: its buttons leave the tab order too
        }
        return;
      }

      // the columns lead upward, so nothing runs past the bottom of the wall
      const r = el.getBoundingClientRect();
      const gone = clamp(-r.top, 0, LAG_MAX);
      if (mode === "p") for (const f of st.figs) move(f, -DRIFT[f.c] * clamp(gone / Math.max(1, r.height)));
      else for (const c of st.cols) move(c, -gone * c.a * 0.5 * (ctx.vw / 1440));
    },
  },
];
