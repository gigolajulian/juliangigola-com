"use client";

import * as React from "react";
import loader from "@/image-loader";
import type { MtFrame } from "../data";
import "./intro.css";

/* v4 home intro, "The canvas" (spec 3.1): JG inks in alone, the whole wall and
   a field of extra frames glide up at .46 scale and cover it, then the view
   pushes in until the top of the wall is the hero. 4500ms, once per visit.
   Every position is measured from the laid-out wall, so it holds at any
   screen ratio. Extras are intro-only nodes, removed when it ends. */

const S0 = 0.46;
const OUT = "cubic-bezier(0.23, 1, 0.32, 1)"; // arrivals and exits
const IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)"; // the push in, a move on screen
const HURRY = 6; // a wheel, tap or key during the intro plays the rest this many times faster
const WALL_FROM = [620, 900, 740]; // px below, per wall column
const X_FROM = [700, 980, 620, 860, 1040, 760, 920]; // px below, per extra column
const RISE = 1700;
const LIGHT = 750; // a photo comes up from black, never an opacity fade
const END = 4500;

function shouldPlay() {
  const root = document.documentElement;
  const q = location.search;
  if (/[?&]intro=0/.test(q) || !("v3motion" in root.dataset)) return false;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (window.scrollY > 4) return false;
  if (/[?&]intro=1/.test(q)) return true;
  try {
    if (sessionStorage.getItem("jg-intro")) return false;
  } catch {}
  return true;
}

export function MtIntro({ extras = [] }: { extras?: MtFrame[] }) {
  const pool = React.useRef(extras);
  React.useEffect(() => {
    pool.current = extras;
  });

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    // the head script hides the header from the first paint (state 1); give it back if the intro will not run
    if (!shouldPlay()) {
      delete root.dataset.mtIntro;
      const calm = matchMedia("(prefers-reduced-motion: reduce)").matches && !/[?&]intro=0/.test(location.search) && window.scrollY <= 4;
      let seen = true;
      try {
        seen = !!sessionStorage.getItem("jg-intro");
        if (calm && !seen) sessionStorage.setItem("jg-intro", "1");
      } catch {}
      if (calm && !seen) document.querySelector('[data-mt="hero"] .mt-wall')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: "ease" });
      return;
    }
    const hero = document.querySelector<HTMLElement>('[data-mt="hero"]');
    const wall = hero?.querySelector<HTMLElement>(".mt-wall");
    if (!hero || !wall) return void delete root.dataset.mtIntro;

    root.dataset.mtIntro = "1"; // wall hidden, scroll locked, until the first frames are ready
    const anims: Animation[] = [];
    const made: HTMLElement[] = [];
    const timers: number[] = [];
    let over = false;
    let started = false;
    const INPUTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    let hurry = () => {};
    const stopHurry = () => INPUTS.forEach((e) => window.removeEventListener(e, hurry));
    const origin = wall.style.transformOrigin;
    const ready: string[] = [];

    const finish = (seen: boolean) => {
      if (over) return;
      over = true;
      stopHurry();
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      made.forEach((n) => n.remove());
      wall.style.transformOrigin = origin;
      delete root.dataset.mtIntro;
      if (seen) {
        try {
          sessionStorage.setItem("jg-intro", "1");
        } catch {}
      }
    };

    const play = (el: Element, frames: Keyframe[], o: KeyframeAnimationOptions) => {
      const a = el.animate(frames, { fill: "both", ...o });
      anims.push(a);
      return a;
    };
    const rise = (el: Element, from: number, delay: number) => {
      play(el, [{ transform: `translate3d(0,${from}px,0)` }, { transform: "translate3d(0,0,0)" }], { duration: RISE, delay, easing: OUT, composite: "add" }); // added on top of the scroll travel, so scrolling as the intro lands never snaps
      // out of sight until it moves, then opaque at once: it comes up out of the ground colour, never an opacity fade
      play(el, [{ visibility: "visible" }, { visibility: "visible" }], { duration: RISE, delay, fill: "forwards" });
    };
    // the ground colour lifts off a column: one opacity per column, so nothing repaints
    const light = (el: Element, delay: number, pseudoElement?: string) => play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: LIGHT, delay, pseudoElement });
    const fadeIn = (sel: string, delay: number, duration: number, lift = 0) =>
      document.querySelectorAll(sel).forEach((el) =>
        play(el, [{ opacity: 0, transform: lift ? `translate3d(0,${lift}px,0)` : "none" }, { opacity: 1, transform: "none" }], { duration, delay, easing: OUT }),
      );

    const run = () => {
      if (started || over) return;
      started = true;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const wr = wall.getBoundingClientRect();
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height };
      };
      // a column is what moves together: the column element, or on phones (columns are `display: contents`) its figures
      type Col = { els: HTMLElement[]; b: ReturnType<typeof box>[]; side: boolean };
      const all = [...wall.querySelectorAll<HTMLElement>(".mt-col")];
      const lead0 = all.find((c) => !c.classList.contains("side"));
      const flat = !!lead0 && getComputedStyle(lead0).display === "contents";
      const cols: Col[] = flat
        ? [0, 1].map((c) => {
            const figs = [...wall.querySelectorAll<HTMLElement>(".mt-col:not(.side) figure")].filter((f) => f.style.getPropertyValue("--c2").trim() === String(c));
            return { els: figs, b: figs.map((f) => box(f.querySelector(".ph")!)).sort((a, z) => a.y - z.y), side: false };
          })
        : all.filter((c) => c.offsetParent !== null && c.querySelector(".ph")).map((c) => ({ els: [c], b: [...c.querySelectorAll(".ph")].map(box), side: c.classList.contains("side") }));
      const core = cols.filter((c) => !c.side && c.b.length);
      if (core.length < 2) return finish(false);
      const first = core[0].b;
      const w = first[0].w;
      const h = first[0].h;
      const R = first.length > 1 ? first[1].y - first[0].y : h * 1.19; // row pitch
      const P = core[1].b[0].x - first[0].x; // column pitch
      const u = w / 403; // the mock's frame is 403 wide

      // the view: scale .46 around a point of the wall that sits at the screen centre
      const px = W / 2 - wr.left;
      const py = hero.getBoundingClientRect().top - wr.top + 1150 * u;
      const ty = H / 2 - (wr.top + py);
      const xmin = px - W / (2 * S0);
      const xmax = px + W / (2 * S0);
      const ymin = py - H / (2 * S0);
      const ymax = py + H / (2 * S0);

      // extras: a layer in the wall's own space
      const layer = document.createElement("div");
      layer.className = "mt-ix";
      layer.setAttribute("aria-hidden", "true");
      wall.prepend(layer);
      made.push(layer);
      let n = 0;
      const top0 = ymin - h - R;
      const tile = (into: HTMLElement, _x: number, y: number) => {
        if (!ready.length) return;
        const t = document.createElement("i");
        t.style.cssText = `top:${y - top0}px;height:${h}px;background-image:url("${ready[n++ % ready.length]}")`;
        into.append(t);
      };
      // a group is one column strip: a small layer, with its own veil
      const group = (x: number, delay: number) => {
        const g = document.createElement("div");
        g.style.cssText = `left:${x}px;top:${top0}px;width:${w}px;height:${ymax - top0 + R}px`;
        const v = document.createElement("b");
        g.append(v);
        layer.append(g);
        light(v, delay);
        return g;
      };

      // the same ratios as the rules that hide side columns once the intro is over (mtscroll.css)
      const tight = matchMedia("(max-aspect-ratio: 19/10)").matches;
      const mid = matchMedia("(max-aspect-ratio: 29/10)").matches;
      const leaves = (el: HTMLElement) => tight || (mid && (el.dataset.col === "-2" || el.dataset.col === "4"));

      // 1. the real columns, each with frames above and below it so the canvas has no holes
      cols.forEach((c, i) => {
        const b = c.b;
        const from = WALL_FROM[i % 3];
        const delay = 800 + i * 110;
        const g = group(b[0].x, delay);
        for (let y = b[0].y - R; y + h > ymin; y -= R) tile(g, b[0].x, y);
        for (let y = b[b.length - 1].y + R; y < ymax; y += R) tile(g, b[0].x, y);
        c.els.forEach((el) => (rise(el, from, delay), flat ? light(el.querySelector(".ph")!, delay, "::after") : light(el, delay, "::after")));
        rise(g, from, delay);
        // a side column this screen does not keep leaves with the extras, so no sliver of it rides the push to the edge of the hero
        if (c.side && leaves(c.els[0])) play(c.els[0], [{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 3000, easing: OUT });
      });
      // 2. extra columns on the wall's own pitch, wherever no real column stands
      const real = cols.map((c) => c.b[0].x);
      let k = 0;
      for (let m = -16; m <= 16; m++) {
        const x = first[0].x + m * P;
        if (x + w < xmin || x > xmax || real.some((r) => Math.abs(r - x) < P * 0.5)) continue;
        const g = group(x, 800 + k * 70);
        for (let y = ymin - h + (k % 2 ? R * 0.25 : 0); y < ymax; y += R) tile(g, x, y);
        rise(g, X_FROM[k % X_FROM.length], 800 + k * 70);
        k++;
      }
      // the extras stay through the push, so the canvas never shrinks to the wall alone; they leave as the push starts, so only the hero frames travel in
      play(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, delay: 3000, easing: OUT });

      // the push in, .46 to 1
      wall.style.transformOrigin = `${px}px ${py}px`;
      const far = `translate3d(0,${ty}px,0) scale(${S0})`;
      play(wall, [{ transform: far, easing: "linear" }, { transform: far, offset: 3000 / END, easing: IN_OUT }, { transform: "translate3d(0,0,0) scale(1)" }], { duration: END });

      // JG, under every photo
      const jg = document.createElement("div");
      jg.className = "mt-jg";
      jg.setAttribute("aria-hidden", "true");
      jg.innerHTML = "<b>J</b><b>G</b>";
      hero.prepend(jg);
      made.push(jg);
      [...jg.children].forEach((b, i) => {
        play(b, [{ opacity: 0, transform: `translate3d(0,${i ? 110 : -110}px,0)`, filter: "blur(22px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: 750, easing: OUT });
        (b as HTMLElement).style.transformOrigin = i ? "0 50%" : "100% 50%";
        play(b, [{ opacity: 1, scale: "1" }, { opacity: 0, scale: ".9" }], { duration: 900, delay: 950, easing: OUT, composite: "replace" });
      });

      // the hero's own parts arrive as the push lands
      fadeIn(".mt-hero .mt-scrim", 3900, 700);
      fadeIn(".mt-hero h1", 3960, 900, 70);
      fadeIn(".mt-hero .mt-cap, .mt-hero .mt-ctas, .site-hdr", 4280, 600);
      fadeIn(".mt-hero figcaption", 4050, 450);

      root.dataset.mtIntro = "2";
      const t0 = performance.now();
      timers.push(window.setTimeout(() => (root.dataset.mtIntro = "3"), 2950)); // scroll unlocks as the frames land
      timers.push(window.setTimeout(() => finish(true), END + 60));
      // nobody is made to wait: a wheel, tap or key plays the rest fast and gives the scroll back
      hurry = () => {
        stopHurry();
        timers.forEach(clearTimeout);
        anims.forEach((a) => a.updatePlaybackRate(HURRY));
        root.dataset.mtIntro = "3";
        timers.push(window.setTimeout(() => finish(true), Math.max(0, END - (performance.now() - t0)) / HURRY + 60));
      };
      for (const e of INPUTS) window.addEventListener(e, hurry, { passive: true, once: true });
    };

    // extras are drawn only from thumbs that have arrived, so the canvas never shows an empty tile
    const want = pool.current.slice(16, 64).map((f) => loader({ src: f.src, width: 640 }));
    let leadIn = false;
    const go = () => leadIn && ready.length >= Math.min(18, want.length) && run();
    want.forEach((src) => {
      const im = new Image();
      im.onload = () => (ready.push(src), go());
      im.src = src;
    });
    // start once the first wall frames and enough extras can paint, or after 1500ms regardless
    const lead = [...wall.querySelectorAll<HTMLImageElement>(".mt-col:not(.side) img")].slice(0, 6);
    Promise.all(lead.map((i) => i.decode().catch(() => {}))).then(() => ((leadIn = true), go()));
    timers.push(window.setTimeout(run, 1500));
    return () => finish(false);
  }, []);

  return null;
}
