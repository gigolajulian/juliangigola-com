"use client";

import * as React from "react";
import loader from "@/image-loader";
import { matches } from "@/lib/device";
import { qflag } from "@/lib/v4-home/flags";
import { EXTRAS, type HomeFrame } from "@/lib/v4-home/data";
import "./intro.css";

/* v4 home intro, "The canvas" (spec 3.1): JG inks in alone, the whole wall and
   a field of extra frames glide up at S0 scale and cover it, then the view
   pushes in until the top of the wall is the hero. 5300ms, once per visit
   (3200ms when this browser has seen it in the last 30 days).
   Every position is measured from the laid-out wall, so it holds at any
   screen ratio. Extras are intro-only nodes, removed when it ends. */

const S0 = 0.56; // the canvas scale: fewer, larger frames
const OUT = "cubic-bezier(0.23, 1, 0.32, 1)"; // arrivals and exits
const IN_OUT = "cubic-bezier(0.65, 0, 0.25, 1)"; // the push in, a move on screen; softer start than (.77,0,.175,1)
const HURRY = 6; // a wheel, tap or key during the intro plays the rest this many times faster
const WALL_FROM = [620, 900, 740]; // px below, per wall column
const X_FROM = [700, 980, 620, 860, 1040, 760, 920]; // px below, per extra column
const RISE = 1700;
const LIGHT = 750; // a photo comes up from black, never an opacity fade
const FULL_END = 5300;
const DRAW = 350; // the columns get their first draw here, out of sight, while JG settles

/* "Depth push", the V4 intro: the same
   canvas, but the frames that are not the hero stand nearer the lens. At rest
   it is the flat canvas; when the camera moves, each of those columns grows
   faster than the wall, slides off past its neighbours, loses focus and is gone
   before the hero lands. The hero is the only plane that stays sharp. Drawn
   in 2D: each strip scales around the point the wall scales around, as a
   plane at depth d would. */
const DEEP_PUSH = 3350; // the full canvas holds about a second before the push
const DEEP_LAND = 4850; // the push lands here (1500ms) and holds to the end
// the push lands and stays, with no overshoot
const DEPTHS = [0.5, 0.28, 0.62, 0.36, 0.56, 0.22, 0.44]; // per extra column: 0 the hero's plane, 1 the lens
const PUSH_Y = 1150; // design px below the hero's top: the point of the wall the push goes into
const WIDE = 3300; // px: from this window width the wall's six rows draw 80 extras, not 60

/* Return visits: a browser that has seen the intro in the last 30 days gets it in 3.2s. The same
   moves with less waiting: JG, the canvas comes up fast, then nearly the same push. First visits keep 5.3s.
   ?intro=1 plays the full one, ?intro=2 the short one. The stamp is local storage "jg-intro-at": a time, nothing else. */
const FULL = { end: FULL_END, push: DEEP_PUSH, land: DEEP_LAND, rise: RISE, light: LIGHT, at: 800, gap: 110, xgap: 55, lead: 450, jg: 750 };
const SHORT = { end: 3200, push: 1500, land: 2850, rise: 900, light: 500, at: 350, gap: 40, xgap: 22, lead: 150, jg: 450 }; // JG gets 350ms alone, the last column is up by 1490
const AGAIN = 30 * 864e5;

export function returning() {
  if (qflag("intro", "2")) return true;
  if (qflag("intro", "1")) return false;
  try {
    const at = Number(localStorage.getItem("jg-intro-at"));
    return at > 0 && Date.now() - at < AGAIN;
  } catch {
    return false;
  }
}

export function shouldPlay() {
  const root = document.documentElement;
  if (qflag("intro", "0") || !("v3motion" in root.dataset)) return false;
  if (matches("calm")) return false;
  if (window.scrollY > 4) return false;
  // the head script already gave the page back at 6s (a slow CPU hydrates later than that): starting now would blank the hero the visitor is looking at
  if ("mtLate" in root.dataset) return false;
  if (qflag("intro", "[12]")) return true;
  try {
    if (sessionStorage.getItem("jg-intro")) return false;
  } catch {}
  return true;
}

/* the preload hold: the splash holds until these have loaded and decoded. CAP_AT: a dead or slow photo never strands the visitor. It starts by
   6s from navigation, the deadline the head script's own fallback uses, and never sooner than today's 1500ms after hydration. */
const CAP_AT = 6000;
/** Photos on screen at any point of the splash: the wall frames inside the canvas view (the screen at scale S0 around the point build() pushes into), and any photo on the first screen at rest. */
function onScreen(hero: HTMLElement, wall: HTMLElement) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const u = (wall.querySelector(".mt-col:not(.side) figure:not(.xr) .ph")?.getBoundingClientRect().width ?? 403) / 403;
  const cy = hero.getBoundingClientRect().top + PUSH_Y * u; // build(): py, in screen space
  const hit = (r: DOMRect, l: number, t: number, rt: number, b: number) => r.width > 0 && r.right > l && r.left < rt && r.bottom > t && r.top < b;
  const imgs = [...document.querySelectorAll<HTMLImageElement>("main img")].filter((i) => i.offsetParent !== null);
  return imgs.filter((i) => {
    const r = i.getBoundingClientRect();
    return hit(r, 0, 0, W, H) || (wall.contains(i) && hit(r, W / 2 - W / (2 * S0), cy - H / (2 * S0), W / 2 + W / (2 * S0), cy + H / (2 * S0)));
  });
}

/** A frame's box in the wall's own space, px. */
type Box = { x: number; y: number; w: number; h: number };
/** A column is what moves together: the column element, or on phones (columns are `display: contents`) its figures. */
type Col = { els: HTMLElement[]; b: Box[]; side: boolean };

/** The canvas, measured from the laid-out wall: the columns, the frame and pitch, and the view at scale S0 around the point the push goes into.
    build() draws from it, and the preload hold counts from it the tiles that build() will draw. */
function canvasOf(hero: HTMLElement, wall: HTMLElement) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const wr = wall.getBoundingClientRect();
  const box = (el: Element): Box => {
    const r = el.getBoundingClientRect();
    return { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height };
  };
  const all = [...wall.querySelectorAll<HTMLElement>(".mt-col")];
  const lead0 = all.find((c) => !c.classList.contains("side"));
  const flat = !!lead0 && getComputedStyle(lead0).display === "contents";
  const cols: Col[] = flat
    ? [0, 1].map((c) => {
        const figs = [...wall.querySelectorAll<HTMLElement>(".mt-col:not(.side) figure:not(.xr)")].filter((f) => f.style.getPropertyValue("--c2").trim() === String(c));
        return { els: figs, b: figs.map((f) => box(f.querySelector(".ph")!)).sort((a, z) => a.y - z.y), side: false };
      })
    : all.filter((c) => c.offsetParent !== null && c.querySelector(".ph")).map((c) => ({ els: [c], b: [...c.querySelectorAll<HTMLElement>(".ph")].filter((ph) => ph.offsetParent !== null).map(box), side: c.classList.contains("side") })); // rows five and six only where they show
  const core = cols.filter((c) => !c.side && c.b.length);
  if (core.length < 2) return null;
  const first = core[0].b;
  const w = first[0].w;
  const h = first[0].h;
  const R = first.length > 1 ? first[1].y - first[0].y : h * 1.19; // row pitch
  const P = core[1].b[0].x - first[0].x; // column pitch
  const u = w / 403; // the mock's frame is 403 wide

  // the view: scale S0 around a point of the wall that sits at the screen centre
  const px = W / 2 - wr.left;
  const py = hero.getBoundingClientRect().top - wr.top + PUSH_Y * u;
  const ty = H / 2 - (wr.top + py);
  const xmin = px - W / (2 * S0);
  const xmax = px + W / (2 * S0);
  const ymin = py - H / (2 * S0);
  const ymax = py + H / (2 * S0);
  return { W, H, flat, cols, core, first, w, h, R, P, u, px, py, ty, xmin, xmax, ymin, ymax };
}

type Canvas = NonNullable<ReturnType<typeof canvasOf>>;
/** The extras layer build() draws into: its top in the wall's space, a tile, and a column strip. */
type Layer = { top0: number; tile: (into: HTMLElement, y: number) => void; group: (x: number, delay: number) => HTMLElement };
type Play = (el: Element, frames: Keyframe[], o: KeyframeAnimationOptions) => Animation;

// `--vis`: the rules that hide side columns once the intro is over say which ones (mtscroll.css)
const leaves = (el: HTMLElement) => getComputedStyle(el).getPropertyValue("--vis").trim() === "hidden";

/** A strip (or a column that leaves) at depth d, 0 the hero's plane and 1 the lens, through the push from `at` to `until`.
    `ox, oy` is the wall's scale point in the element's own box. */
function depth(play: Play, el: HTMLElement, ox: number, oy: number, d: number, at: number, until: number) {
  el.style.transformOrigin = `${ox}px ${oy}px`;
  el.style.zIndex = String(Math.round(d * 100));
  const r = (1 - d * S0) / (1 - d); // how much more than the wall this plane has grown when the wall is at 1
  const dur = until - at;
  const blur = Math.round(5 + d * 14);
  const gone = 0.74 - d * 0.22; // nearer planes pass the lens sooner
  play(el, [{ scale: "1", easing: IN_OUT }, { scale: String(r) }], { duration: dur, delay: at });
  play(
    el,
    [
      { opacity: 1, filter: "blur(0px)" },
      { opacity: 1, filter: `blur(${blur * 0.25}px)`, offset: 0.34 },
      { opacity: 0, filter: `blur(${blur}px)`, offset: gone },
      { opacity: 0, filter: `blur(${blur}px)` },
    ],
    { duration: dur, delay: at },
  );
}

/** Extra tiles build() draws: above and below each real column, and the columns on the wall's pitch where none stands. Its loops, counted. */
function tilesOf(g: Canvas) {
  const { cols, first, w, h, R, P, xmin, xmax, ymin, ymax } = g;
  let n = 0;
  for (const { b } of cols) {
    for (let y = b[0].y - R; y + h > ymin; y -= R) n++;
    for (let y = b[b.length - 1].y + R; y < ymax; y += R) n++;
  }
  const real = cols.map((c) => c.b[0].x);
  let k = 0;
  for (let m = -16; m <= 16; m++) {
    const x = first[0].x + m * P;
    if (x + w < xmin || x > xmax || real.some((r) => Math.abs(r - x) < P * 0.5)) continue;
    for (let y = ymin - h + (k % 2 ? R * 0.25 : 0); y < ymax; y += R) n++;
    k++;
  }
  return n;
}

/** The preload hold: one thumb per extra tile this screen's canvas draws (so none is fetched and never shown), at a width that covers it at this pixel ratio. */
function fitExtras(hero: HTMLElement, wall: HTMLElement) {
  const g = canvasOf(hero, wall);
  if (!g) return null;
  // a tile is drawn at S0 and blurs out as it grows with the push, so its drawn size is enough. Three widths, so the resizer keeps few copies.
  const px = g.w * S0 * devicePixelRatio;
  return { n: Math.max(1, tilesOf(g)), width: px <= 256 ? 256 : px <= 384 ? 384 : 640 };
}

export function HomeIntro({ extras = [] }: { extras?: HomeFrame[] }) {
  const pool = React.useRef(extras);
  React.useEffect(() => {
    pool.current = extras;
  });

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    // the head script hides the header from the first paint (state 1); give it back if the intro will not run
    if (!shouldPlay()) {
      delete root.dataset.mtIntro;
      const calm = matches("calm") && !qflag("intro", "0") && window.scrollY <= 4;
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
    root.dataset.mtOwn = ""; // the intro holds state 1 now, with its own cap: the head script's 6s fallback stands down
    // While the splash covers the page (states 1 and 2) nothing under it takes focus: Tab landed on header links at opacity 0.
    const under = [document.querySelector<HTMLElement>(".site-hdr"), document.getElementById("main")].filter((n): n is HTMLElement => !!n);
    const lock = new MutationObserver(() => {
      const on = root.dataset.mtIntro === "1" || root.dataset.mtIntro === "2";
      under.forEach((n) => (n.inert = on));
      if (!("mtIntro" in root.dataset)) lock.disconnect();
    });
    lock.observe(root, { attributeFilter: ["data-mt-intro"] });
    under.forEach((n) => (n.inert = true));
    const anims: Animation[] = [];
    const made: HTMLElement[] = [];
    const timers: number[] = [];
    /* Out of sight until it moves, then opaque at once: it comes up out of the ground colour, never an opacity fade.
       The browser skips whatever is fully hidden, and the first draw of the columns holds the screen for about 100ms.
       So each one waits at opacity 0, goes to 1% under its veil at DRAW, and is drawn before the first column moves. */
    const unseen: [Element, number][] = [];
    const noTap: HTMLElement[] = [];
    let finished = false; // the intro has ended
    let raf = 0;
    let started = false;
    let pace = FULL; // the short one on a return visit, chosen when it starts
    const INPUTS = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    let hurry = () => {};
    const stopHurry = () => INPUTS.forEach((e) => window.removeEventListener(e, hurry));
    const origin = wall.style.transformOrigin;
    const ready: string[] = [];
    const preload = !qflag("preload", "0"); // on by default; ?preload=0 is the old 6 + 18 start
    const parked: [HTMLImageElement, string | null, string | null][] = [];

    const finish = (seen: boolean) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      stopHurry();
      timers.forEach(clearTimeout);
      anims.forEach((a) => a.cancel());
      made.forEach((n) => n.remove());
      noTap.forEach((h) => (h.style.pointerEvents = ""));
      parked.forEach(([i, set, src]) => (set && i.setAttribute("srcset", set), src && i.setAttribute("src", src)));
      wall.style.transformOrigin = origin;
      delete root.dataset.mtIntro;
      delete root.dataset.mtOwn;
      if (seen) {
        try {
          sessionStorage.setItem("jg-intro", "1");
          localStorage.setItem("jg-intro-at", String(Date.now()));
        } catch {}
      }
    };

    const play = (el: Element, frames: Keyframe[], o: KeyframeAnimationOptions) => {
      const a = el.animate(frames, { fill: "both", ...o });
      anims.push(a);
      return a;
    };
    const rise = (el: Element, from: number, delay: number) => {
      play(el, [{ transform: `translate3d(0,${from}px,0)` }, { transform: "translate3d(0,0,0)" }], { duration: pace.rise, delay, easing: OUT, composite: "add" }); // added on top of the scroll travel, so scrolling as the intro lands never snaps
      unseen.push([el, delay]);
    };
    // the ground colour lifts off a column: one opacity per column, so nothing repaints
    const light = (el: Element, delay: number, pseudoElement?: string) => play(el, [{ opacity: 1 }, { opacity: 0 }], { duration: pace.light, delay, pseudoElement });
    const fadeIn = (sel: string, delay: number, duration: number, lift = 0) =>
      document.querySelectorAll(sel).forEach((el) =>
        play(el, [{ opacity: 0, transform: lift ? `translate3d(0,${lift}px,0)` : "none" }, { opacity: 1, transform: "none" }], { duration, delay, easing: OUT }),
      );

    // a throw while building the intro gives the page back (scroll, focus, wall) instead of leaving it locked
    const run = () => {
      if (started || finished) return;
      started = true;
      try {
        build();
      } catch (e) {
        finish(false);
        throw e;
      }
    };
    // extras: a layer in the wall's own space, and what draws into it
    const canvasLayer = (g: Canvas) => {
      const { w, h, R, ymin, ymax } = g;
      const layer = document.createElement("div");
      layer.className = "mt-ix";
      layer.setAttribute("aria-hidden", "true");
      wall.prepend(layer);
      made.push(layer);
      let n = 0;
      const top0 = ymin - h - R;
      /* Arrived thumbs first, then the ones still on the way: on a slow laptop the 1500ms start can come with only a
         few in, and cycling those filled whole edge columns with one photo (Windows Chrome). A tile on a
         thumb still loading stays dark until its own photo lands. */
      const pick = [...ready, ...want.map((s) => new URL(s, location.href).href).filter((s) => !ready.includes(s))]; // ready holds im.src, always absolute
      const tile = (into: HTMLElement, y: number) => {
        if (!pick.length) return;
        const t = document.createElement("i");
        t.style.cssText = `top:${y - top0}px;height:${h}px;background-image:url("${pick[n++ % pick.length]}")`;
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
      return { top0, tile, group };
    };

    // JG, under every photo. It stays lit while the wall rises over it, and goes only once the frames have covered it.
    const monogram = (g: Canvas) => {
      const { W, cols, w, px } = g;
      const jg = document.createElement("div");
      jg.className = "mt-jg";
      jg.setAttribute("aria-hidden", "true");
      jg.append(...["J", "G"].map((ch) => Object.assign(document.createElement("b"), { textContent: ch })));
      hero.prepend(jg);
      made.push(jg);
      [...jg.children].forEach((b, i) => {
        play(b, [{ opacity: 0, transform: `translate3d(0,${i ? 110 : -110}px,0)`, filter: "blur(22px)" }, { opacity: 1, transform: "none", filter: "blur(0)" }], { duration: pace.jg, easing: OUT });
      });
      const marks = [...jg.children] as HTMLElement[];
      const jr = jg.getBoundingClientRect();
      const jl = jr.left + Math.min(...marks.map((m) => m.offsetLeft));
      const jw = Math.max(...marks.map((m) => m.offsetLeft + m.offsetWidth)) - Math.min(...marks.map((m) => m.offsetLeft));
      const jt = jr.top + Math.min(...marks.map((m) => m.offsetTop));
      // the columns that pass over it: where they stand on screen once the canvas is up
      const over = cols.filter((c) => {
        const x = (c.b[0].x - px) * S0 + W / 2;
        return x < jl + jw && x + w * S0 > jl;
      });
      const jb = jt + Math.max(...marks.map((m) => m.offsetHeight));
      return { jg, jt, jb, over };
    };

    // 1. the real columns, each with frames above and below it so the canvas has no holes
    const realColumns = (g: Canvas, lay: Layer, over: Set<Col>, jb: number) => {
      const { H, flat, cols, h, R, px, py, ymin, ymax } = g;
      cols.forEach((c, i) => {
        const b = c.b;
        const delay = pace.at + i * pace.gap;
        const pass = over.has(c);
        const lit = pass ? Math.max(0, delay - pace.lead) : delay; // lit before it moves: it enters from off screen
        const g = lay.group(b[0].x, lit);
        let topY = b[0].y;
        for (let y = b[0].y - R; y + h > ymin; y -= R) lay.tile(g, (topY = y));
        // its leading edge starts under the screen, or under the monogram on a tall screen
        const edge = H / 2 + (topY - py) * S0;
        const from = pass ? Math.max(WALL_FROM[i % 3], (Math.min(H, jb + 260) + 24 - edge) / S0) : WALL_FROM[i % 3];
        for (let y = b[b.length - 1].y + R; y < ymax; y += R) lay.tile(g, y);
        c.els.forEach((el) => (rise(el, from, delay), light(flat ? el.querySelector(".ph")! : el, lit, "::after")));
        rise(g, from, delay);
        // a side column this screen does not keep leaves with the extras, so no sliver of it rides the push to the edge of the hero
        const out = c.side && leaves(c.els[0]);
        depth(play, g, px - b[0].x, py - lay.top0, out ? 0.4 : 0.18, pace.push, pace.land); // the frames above and below a column are not the hero either
        if (out) depth(play, c.els[0], px - c.els[0].offsetLeft, py - c.els[0].offsetTop, 0.4, pace.push, pace.land);
      });
    };

    // 2. extra columns on the wall's own pitch, wherever no real column stands
    const extraColumns = (g: Canvas, lay: Layer) => {
      const { cols, first, w, h, R, P, px, py, xmin, xmax, ymin, ymax } = g;
      const real = cols.map((c) => c.b[0].x);
      let k = 0;
      for (let m = -16; m <= 16; m++) {
        const x = first[0].x + m * P;
        if (x + w < xmin || x > xmax || real.some((r) => Math.abs(r - x) < P * 0.5)) continue;
        const s = lay.group(x, pace.at + k * pace.xgap);
        for (let y = ymin - h + (k % 2 ? R * 0.25 : 0); y < ymax; y += R) lay.tile(s, y);
        rise(s, X_FROM[k % X_FROM.length], pace.at + k * pace.xgap);
        depth(play, s, px - x, py - lay.top0, DEPTHS[k % DEPTHS.length], pace.push, pace.land);
        k++;
      }
    };

    // JG goes once every column over it has passed its top, and before the camera moves whatever the layout
    const watchJg = (jg: HTMLElement, over: Col[], jt: number) => {
      let jgGone = false;
      const hideJg = () => {
        if (jgGone) return;
        jgGone = true;
        play(jg, [{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: OUT });
      };
      const watch = () => {
        if (finished || jgGone) return;
        if (over.length && over.every((c) => Math.min(...c.els.map((el) => el.getBoundingClientRect().top)) < jt - 12)) return hideJg();
        raf = requestAnimationFrame(watch);
      };
      raf = requestAnimationFrame(watch);
      timers.push(window.setTimeout(hideJg, pace.push));
    };

    // made last, so they sit on top of every other opacity animation on the same element
    const veil = () =>
      unseen.forEach(([el, delay]) => {
        const at = Math.min(DRAW, delay / 2);
        play(el, [{ opacity: 0 }, { opacity: 0 }], { duration: at, fill: "none" });
        play(el, [{ opacity: 0.01 }, { opacity: 0.01 }], { duration: delay - at, delay: at, fill: "none" });
        // unseen, so untouchable: a tap that hurries the intro must not open a project
        const h = el as HTMLElement;
        h.style.pointerEvents = "none";
        noTap.push(h);
        timers.push(window.setTimeout(() => (h.style.pointerEvents = ""), delay));
      });

    // nobody is made to wait: a wheel, tap or key plays the rest fast and gives the scroll back
    const arm = (t0: number, END: number) => {
      hurry = () => {
        stopHurry();
        timers.forEach(clearTimeout);
        anims.forEach((a) => a.updatePlaybackRate(HURRY));
        root.dataset.mtIntro = "3";
        timers.push(window.setTimeout(() => finish(true), Math.max(0, END - (performance.now() - t0)) / HURRY + 60));
      };
      for (const e of INPUTS) window.addEventListener(e, hurry, { passive: true, once: true });
    };

    const build = () => {
      const short = returning();
      pace = short ? SHORT : FULL;
      const END = pace.end; // every time below is this run's
      const pushAt = pace.push;
      const land = pace.land;
      const g = canvasOf(hero, wall);
      if (!g) return finish(false);
      const { px, py, ty } = g;
      const lay = canvasLayer(g);
      const { jg, jt, jb, over } = monogram(g);
      realColumns(g, lay, new Set(over), jb);
      extraColumns(g, lay);
      // the push in, S0 to 1
      wall.style.transformOrigin = `${px}px ${py}px`;
      const far = `translate3d(0,${ty}px,0) scale(${S0})`;
      const home = "translate3d(0,0,0) scale(1)";
      play(
        wall,
        [
          { transform: far, easing: "linear" },
          { transform: far, offset: pushAt / END, easing: IN_OUT },
          { transform: home, offset: land / END }, // the push lands and holds
          { transform: home },
        ],
        { duration: END },
      );
      watchJg(jg, over, jt);

      // the hero's own parts arrive as the push lands
      fadeIn(".mt-hero .mt-scrim", land - 250, 700);
      fadeIn(".mt-hero h1", land - 190, 900, 24);
      fadeIn(".mt-hero .mt-cap, .mt-hero .mt-ctas, .site-hdr", land + 130, 600);
      fadeIn(".mt-hero figcaption", land - 100, 450);
      veil();

      root.dataset.mtIntro = "2";
      const t0 = performance.now();
      timers.push(window.setTimeout(() => (root.dataset.mtIntro = "3"), pushAt - 50)); // scroll unlocks as the frames land
      timers.push(window.setTimeout(() => finish(true), END + 60));
      arm(t0, END);
    };

    // extras are drawn only from thumbs that have arrived, so the canvas never shows an empty tile
    // where rows five and six show (wide screens) the wall itself uses extras up to 29, so the canvas draws from the ones after
    const rows6 = !!wall.querySelector<HTMLElement>("figure.xr")?.offsetParent && pool.current.length >= 48;
    const from = rows6 ? EXTRAS.wall : EXTRAS.sides;
    const fit = preload ? fitExtras(hero, wall) : null; // the preload hold: only as many as this screen's canvas draws, at the size it draws them
    const upto = rows6 ? (window.innerWidth >= WIDE ? 80 : 60) : 46; // ?preload=0: the old fixed set, its tiles repeat past it
    // the preload hold: one photo per drawn tile, up to the whole pool (an iPad in portrait draws 37 to 39), so no tile repeats while the pool lasts
    const want = pool.current.slice(from, fit ? from + fit.n : upto).map((f) => loader({ src: f.src, width: fit?.width ?? 640 }));
    let leadIn = false;
    let dead = 0; // extras that failed for good: they count as settled, so one dead file never holds the splash
    const go = () => leadIn && (preload ? ready.length + dead >= want.length : ready.length >= Math.min(18, want.length)) && run();
    let plain = 0;
    want.forEach((src) => {
      const im = new Image();
      im.onload = () => (ready.push(im.src), go());
      // the resizer blocked (a content blocker, a preview host): the plain file, as ImageFallback does for pictures in the page.
      // These images are not in the page, so its listener never hears them. shortcut: 18 originals at most, enough to start; they repeat across the canvas.
      im.onerror = () => {
        const rest = /\/cdn-cgi\/image\/[^/]+\/(.+)$/.exec(im.src)?.[1];
        if (rest && plain++ < 18) im.src = rest.startsWith("http") ? rest : `/${rest}`;
        else dead++;
      };
      im.src = src;
    });
    // ?preload=0: start once the first wall frames and enough extras can paint, or after 1500ms regardless.
    // the preload hold: every photo the splash will show, on the canvas or on the first screen after it, and the extras this screen draws, by 6s at the latest.
    const lead = preload ? onScreen(hero, wall) : [...wall.querySelectorAll<HTMLImageElement>(".mt-col:not(.side) figure:not(.xr) img")].slice(0, 6);
    if (preload) lead.forEach((i) => (i.loading = "eager")); // lazy frames off the first screen would wait for a scroll that is locked
    // the preload hold: lazy pictures further down (film posters at full width) start inside the browser's own look-ahead and take the splash's
    // bandwidth. Nothing scrolls until the splash ends, so they wait for it: both attributes off (no request, no error event), back in finish().
    if (preload)
      for (const i of document.querySelectorAll<HTMLImageElement>("main img[loading=lazy]")) {
        if (i.complete || lead.includes(i)) continue;
        parked.push([i, i.getAttribute("srcset"), i.getAttribute("src")]);
        i.removeAttribute("srcset");
        i.removeAttribute("src");
      }
    Promise.all(lead.map((i) => i.decode().catch(() => {}))).then(() => ((leadIn = true), go()));
    timers.push(window.setTimeout(run, preload ? Math.max(1500, CAP_AT - performance.now()) : 1500));
    return () => finish(false);
  }, []);

  return null;
}
