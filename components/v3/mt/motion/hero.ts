import { navfx } from "../../nav-ink";
import { clamp, smooth, span, type Driver } from "./engine";

/* Hero wall travel (spec 3.2). Held (D): the wall travels up through the hold,
   each column trailing by its lag A, and the name block leaves once at the end.
   Not held: the page scrolls the wall itself and the columns only drift. */

const WALL = 2640; // wall height with four rows, design px (mtscroll.css); measured off the columns below, since wide screens show six
const TAIL = 264; // ground left under the last row when the travel ends, so "See the work" sits under the photos with room above it
const LAG_MAX = 2400;
const END_D = [280, 0, 70]; // (right was 40: Julian, 2026-11-15, "a bit lower") how far each of the three locked columns has dropped behind when the travel ends, design px: mirrors the ends 0.12, 0, 0.2 gave at 1440x900
const DRIFT = [40, 22]; // phone drift caps, px, per column

type Part = { el: HTMLElement; a: number; c: number; v: number };

/* Name dock (Julian's pick 02, 2026-11-14; off since 2026-11-16, "should not animate up towards the nav bar": ?mtdock=1 brings it back). Held layout only. The header starts without its
   wordmark. Between 62% and 92% of the hold a fixed copy of the name, same face and size, rides from the h1's place to
   the wordmark's and shrinks to its size, then the real wordmark takes over. The copy follows its target on a critically
   damped spring, so it leaves late and settles soft: the October version was locked 1:1 to the scroll over one name
   height and read as not smooth. The label fades at 48 to 62%, the buttons at 72 to 92% (his timing).
   ?mtdock=<n> above 1 sets the spring's stiffness in rad/s, to tune by eye.
   html[data-mtdock] is rest, ride or land, or off when there is no dock: hero.css hides the wordmark until land. */
const DOCK_W = 11;
type Geo = { ax: number; ay: number; bx: number; by: number; k: number; ox: number; oy: number; ws: number };
type Dock = { f: HTMLElement; words: HTMLElement[]; h1: HTMLElement; wm: HTMLElement; cap: HTMLElement | null; ctas: HTMLElement | null; scrim: HTMLElement | null; w: number; m: Geo | null; x: number; v: number; st: string; q: string };
type State = { cols: Part[]; figs: Part[]; caps: HTMLElement[]; texts: HTMLElement[]; ctas: HTMLElement | null; more: HTMLElement | null; name: HTMLElement | null; s: number; mode: string; e: number; u: number; at: string; wall: number; dock: Dock | null; bar: HTMLElement | null; out: boolean; row: number };

const ink = (n: Node) => {
  const r = document.createRange();
  r.selectNodeContents(n);
  return r.getBoundingClientRect();
};

/* ?mtdock=left (Julian 2026-11-15): no dock. The header keeps its links from the start with no
   ground under them, the name leaves to the left as the hero ends, and the header's ground comes in there. The bar's
   wordmark waits until the big name has gone (2026-11-16: "never together"; the header trial does that). */
const LEFT = typeof location !== "undefined" && /[?&]mtdock=left/.test(location.search);
/* With no ground over the hero the nav words sit on the wall: they flip white or black (nav-ink.ts; the flag turns
   ?navfx on in layout.tsx), and page text fades out under the bar there (the same file's text fade). */

function dockSetup(el: HTMLElement): Dock | null {
  if (LEFT) return null;
  const w = Number(/[?&]mtdock=([\d.]+)/.exec(location.search)?.[1] ?? 0);
  const h1 = el.querySelector<HTMLElement>(".mt-name h1"), wm = document.querySelector<HTMLElement>(".site-hdr .site-wm");
  // ?navfx=1 (Julian, 2026-11-15): no flight. The name fades with the hero, and the bar's wordmark comes in as it goes (nav-ink.ts).
  if (!w || !h1 || !wm || navfx()) return null;
  const f = document.createElement("div");
  f.className = "mt-dockname";
  f.setAttribute("aria-hidden", "");
  // one span a word: the h1 sets its words wider apart than the wordmark does, so the gap closes on the way, by transform
  const words = (h1.textContent ?? "").split(" ").map((w) => Object.assign(document.createElement("span"), { textContent: w }));
  words.forEach((w, i) => {
    w.style.display = "inline-block";
    f.append(i ? " " : "", w);
  });
  // above the header (z 30): its backdrop blur would soften the name on the way in
  Object.assign(f.style, { position: "fixed", left: "0", top: "0", margin: "0", zIndex: "31", pointerEvents: "none", whiteSpace: "nowrap", transformOrigin: "0 0", willChange: "transform", visibility: "hidden" });
  document.body.append(f);
  const q = (s: string) => el.querySelector<HTMLElement>(s);
  return { f, words, h1, wm, cap: q(".mt-cap"), ctas: q(".mt-ctas"), scrim: q(".mt-scrim"), w: w > 1 ? w : DOCK_W, m: null, x: -1, v: 0, st: "", q: "" };
}

function dockOff(d: Dock) {
  d.st = d.q = "";
  d.x = -1;
  d.f.style.visibility = "hidden";
  d.h1.style.opacity = "";
  for (const n of [d.cap, d.ctas, d.scrim]) if (n) n.style.cssText = "";
  document.documentElement.removeAttribute("data-mtdock");
}

// where the name rests and where it lands, in the window: the stage is stuck at the top for the whole ride
function dockMeasure(d: Dock, name: HTMLElement) {
  const cs = getComputedStyle(d.h1), a = ink(d.h1), top = name.getBoundingClientRect().top;
  Object.assign(d.f.style, { transform: "none", fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontSize: cs.fontSize, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, wordSpacing: "0px", textTransform: cs.textTransform, color: cs.color });
  for (const w of d.words) w.style.transform = "";
  const o = ink(d.f), b = ink(d.wm), k = b.width / o.width;
  // landed, the copy's line box is centred on the wordmark's: the two differ a hair in tracking, so match by width, both with the words set close
  d.m = a.width ? { ax: a.left, ay: a.top - top, bx: b.left, by: b.top + b.height / 2 - (a.height * k) / 2, k, ox: o.left, oy: o.top, ws: parseFloat(cs.wordSpacing) || 0 } : null;
  d.x = -1;
  d.q = "";
}

function dockFrame(d: Dock, p: number, dt: number, jump: boolean) {
  const m = d.m;
  if (!m) return;
  const t = smooth(span(p, 0.62, 0.92));
  if (d.x < 0 || jump) {
    d.x = t;
    d.v = 0;
  } else {
    // critically damped, in small steps so a slow frame cannot throw it
    let n = Math.max(1, Math.ceil(dt / 8));
    const h = dt / 1000 / n;
    while (n--) {
      d.v += (-2 * d.w * d.v - d.w * d.w * (d.x - t)) * h;
      d.x += d.v * h;
    }
    if (d.x < 0 || d.x > 1) {
      d.x = clamp(d.x);
      d.v = 0;
    }
    if ((t === 0 || t === 1) && Math.abs(d.x - t) < 0.0005) {
      d.x = t;
      d.v = 0;
    }
  }
  // "land" holds until the target has really left the top, so the hand-over cannot flicker at the edge
  const st = d.x <= 0 ? "rest" : d.x >= 1 || (d.st === "land" && t > 0.995) ? "land" : "ride";
  if (st !== d.st) {
    d.st = st;
    if (st === "ride") d.f.style.color = getComputedStyle(d.h1).color; // the theme may have changed since the measure
    d.f.style.visibility = st === "ride" ? "visible" : "hidden";
    d.h1.style.opacity = st === "rest" ? "" : "0"; // still there for readers and search
    document.documentElement.setAttribute("data-mtdock", st);
  }
  if (st === "ride") {
    const s = 1 + (m.k - 1) * d.x;
    const tf = `translate3d(${(m.ax + (m.bx - m.ax) * d.x - m.ox * s).toFixed(2)}px,${(m.ay + (m.by - m.ay) * d.x - m.oy * s).toFixed(2)}px,0) scale(${s.toFixed(5)})`;
    if (tf !== d.f.style.transform) {
      d.f.style.transform = tf;
      d.words.forEach((w, i) => i && (w.style.transform = `translate3d(${(m.ws * i * (1 - d.x)).toFixed(2)}px,0,0)`));
    }
  }
  const cap = 1 - span(p, 0.48, 0.62), go = 1 - span(p, 0.72, 0.92), sc = 1 - span(p, 0.62, 0.92);
  const q = cap.toFixed(3) + go.toFixed(3) + sc.toFixed(3);
  if (q === d.q) return;
  d.q = q;
  // at rest nothing is written: an inline 1 beat the splash's own `opacity:0` rule, so the caption and buttons
  // stood alone on the empty page until the splash started (seen in Safari, 2026-11-15)
  const op = (v: number) => (v >= 1 ? "" : v.toFixed(3));
  if (d.cap) d.cap.style.opacity = op(cap);
  if (d.scrim) d.scrim.style.opacity = op(sc);
  if (d.ctas) {
    d.ctas.style.opacity = op(go);
    d.ctas.style.visibility = go <= 0 ? "hidden" : ""; // gone: the buttons leave the tab order too
  }
}
const states = new WeakMap<HTMLElement, State>();

/* An unseen margin round the name, the tagline and the buttons (Julian, 2026-11-16: a photo's caption ran through the
   tagline). A caption within PAD of any of them hides (hero.css fades it) and comes back once clear. Held layout only. */
const PAD = 12;
function clearance(st: State, on: boolean) {
  const z = on ? [...st.texts.map(ink), ...(st.ctas ? [st.ctas.getBoundingClientRect()] : [])].filter((r) => r.width) : [];
  const hit = st.caps.map((c) => {
    if (!z.length) return false;
    const r = c.getBoundingClientRect();
    return z.some((q) => r.left < q.right + PAD && r.right > q.left - PAD && r.top < q.bottom + PAD && r.bottom > q.top - PAD);
  });
  st.caps.forEach((c, i) => c.toggleAttribute("data-under", hit[i]));
}

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
        cols: [...el.querySelectorAll<HTMLElement>(".mt-col")].map((n) => part(n, Number(n.dataset.a) || 0, Number(n.dataset.col))),
        figs: [...el.querySelectorAll<HTMLElement>(".mt-col:not(.side) figure")].map((n) => part(n, 0, Number(n.style.getPropertyValue("--c2")) || 0)),
        caps: [...el.querySelectorAll<HTMLElement>(".mt-col figcaption span")],
        texts: [...el.querySelectorAll<HTMLElement>(".mt-name h1, .mt-name .mt-cap")],
        ctas: el.querySelector<HTMLElement>(".mt-name .mt-ctas"),
        more: el.querySelector<HTMLElement>(".mt-more .btn"),
        name: el.querySelector<HTMLElement>("[data-mt-name]"),
        s: -1,
        mode: "",
        e: -1,
        u: 0,
        at: "",
        wall: WALL,
        dock: dockSetup(el),
        bar: document.querySelector<HTMLElement>(".site-hdr"),
        out: false,
        row: 660,
      };
      states.set(el, st);
      const d = st.dock;
      if (!d) document.documentElement.setAttribute("data-mtdock", "off");
      // by scroll, not by frame: a jump past the hero gets no hero frames
      // the hero is over when its last photos have left from under the header: the same line going down and coming back up
      const hdr = document.querySelector<HTMLElement>(".site-hdr");
      const past = () => document.documentElement.toggleAttribute("data-mt-pasthero", el.getBoundingClientRect().bottom <= (hdr?.offsetHeight ?? 60));
      if (LEFT) document.documentElement.setAttribute("data-mtleft", "");
      // always: phones keep the wordmark out of the bar while the hero is on screen (mtscroll.css)
      addEventListener("scroll", past, { passive: true });
      past();
      // late fonts move both boxes: measure again on the next frame
      if (d) document.fonts?.ready.then(() => (st.at = ""), () => {});
      /* The engine gives a section no frames once it is a screen above the window. A jump past the hero (a reload
         lower on the page, a header link, a flick) would leave the name wherever it was and the header without its
         wordmark, so land it here. */
      const far = () => {
        if (!d || d.st === "land" || !document.documentElement.hasAttribute("data-mt-held") || el.getBoundingClientRect().bottom > -innerHeight) return;
        d.st = "land";
        d.x = 1;
        d.v = 0;
        d.f.style.visibility = "hidden";
        d.h1.style.opacity = "0";
        document.documentElement.setAttribute("data-mtdock", "land");
      };
      if (d) {
        addEventListener("scroll", far, { passive: true });
        requestAnimationFrame(() => requestAnimationFrame(far));
      }
      return () => {
        removeEventListener("scroll", far);
        removeEventListener("scroll", past);
        document.documentElement.removeAttribute("data-mtleft");
        document.documentElement.removeAttribute("data-mt-pasthero");
        document.documentElement.removeAttribute("data-mt-nameout");
        [...st.cols, ...st.figs].forEach((p) => (p.el.style.transform = ""));
        if (st.name) st.name.style.cssText = "";
        clearance(st, false);
        if (d) {
          dockOff(d);
          d.f.remove();
        }
        document.documentElement.removeAttribute("data-mtdock");
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
        if (st.dock) dockOff(st.dock);
        document.documentElement.removeAttribute("data-mt-nameout");
        clearance(st, false);
        st.at = "";
      }

      if (mode === "d") {
        // the wall's own unit: big screens fit more columns by shrinking it (mtscroll.css), so measure it off a column, once a size
        const at = ctx.vw + "x" + ctx.vh;
        if (at !== st.at) {
          st.at = at;
          const core = st.cols.filter((c) => !c.el.classList.contains("side"));
          st.u = (core[0]?.el.offsetWidth ?? 0) / 403 || ctx.u;
          // the lowest column end plus the 46 design px under it: 2640 with four rows
          st.wall = core.length ? Math.max(...core.map((c) => c.el.offsetTop + c.el.offsetHeight)) / st.u + 46 : WALL;
          // one row of the wall, px: from one photo's top to the next in a column
          const two = core[0]?.el.querySelectorAll<HTMLElement>("figure");
          st.row = (two && two[1] ? two[1].offsetTop - two[0].offsetTop : 0) || 660 * st.u;
          if (st.dock && st.name) dockMeasure(st.dock, st.name);
        }
        const u = st.u;
        // the ground under the last row is in the page's unit, like the button that sits in it
        const target = p * Math.max(0, st.wall * u + TAIL * ctx.u - Math.max(ctx.vh, 600));
        // a 0.64 follow (0.4 until Julian halved the delay a second time, 2026-11-17), frame-rate independent (the live Recent()'s 0.2 felt laggy here: Julian, 2026-11-17, "half the delay")
        st.s = st.s < 0 || Math.abs(target - st.s) < 0.1 ? target : st.s + (target - st.s) * (1 - Math.pow(0.36, ctx.dt / 16.7));
        const S = st.s;
        /* Where the wall ends (Julian, 2026-11-15): with three columns the left one ends lowest and the right one
           highest, a stair down to the left, so "See the work" on the right has the open corner. The markup's lags
           ended it the other way round. Five and seven columns already end high on the right, so they keep theirs. */
        const three = ctx.vw < 1920;
        // a share of the travel, not of the distance: a tall window travels less and must still end on the same stair
        const share = S / Math.max(1, st.wall * u + TAIL * ctx.u - Math.max(ctx.vh, 600));
        for (const c of st.cols) move(c, -(S - (three && c.c in END_D ? share * END_D[c.c] * u : Math.min(S, LAG_MAX * u) * c.a * 0.5)));
        if (st.dock) {
          // a jump (a load or a link that lands mid page) places the name, it does not fly it
          dockFrame(st.dock, p, ctx.dt, Math.abs(ctx.dy) > ctx.vh);
          return;
        }
        /* Julian, 2026-11-16: "it needs to stay in place until 3 rows are scrolled and move down and out". The name
           holds until the fourth row is whole in the window (its lower edge at the window's: "pinned to screen for
           3-4 rows"), then rides down out of the window. 2026-11-17: "too quick, it needs to go out a bit slower with parallax": the ride takes
           0.8 of a row, and the tagline and buttons sink ahead of the name (--mt-out, hero.css). Never later than the travel allows. */
        // 2026-11-17: "end julian gigola large right before see the work button shows up on screen": the ride is read off
        // the button itself, a row of scroll long, and is over 16px before the button's top edge enters the window
        const gap = st.more ? st.more.getBoundingClientRect().top - ctx.vh : 0;
        const e = Math.round(smooth(clamp(1 - (gap - 16) / Math.max(1, st.row))) * 1000) / 1000;
        if (st.name && e !== st.e) {
          st.e = e;
          st.out = e >= 1;
          st.name.style.transform = e ? `translate3d(0,${(0.6 * ctx.vh * e).toFixed(1)}px,0)` : "";
          st.name.style.setProperty("--mt-out", String(e));
          st.name.style.visibility = st.out ? "hidden" : ""; // gone: its buttons leave the tab order too
          // the bar's wordmark comes in as the big name is out, and goes as it comes back (mtscroll.css)
          document.documentElement.toggleAttribute("data-mt-nameout", st.out);
        }
        clearance(st, !st.out);
        return;
      }

      // the columns lead upward, so nothing runs past the bottom of the wall
      const gone = clamp(-ctx.top, 0, LAG_MAX);
      if (mode === "p") for (const f of st.figs) move(f, -DRIFT[f.c] * clamp(gone / Math.max(1, ctx.h)));
      else for (const c of st.cols) move(c, -gone * c.a * 0.5 * (ctx.vw / 1440));
    },
  },
];
