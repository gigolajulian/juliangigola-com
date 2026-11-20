import { qflag } from "@/lib/mtflags";
import { clamp, type Ctx, type Driver } from "./engine";

/* Hero wall travel (spec 3.2). Held (D): the wall travels up through the hold,
   each column trailing by its lag A, and the name block leaves once at the end.
   Not held: the page scrolls the wall itself and the columns only drift. */

const WALL = 2640; // wall height with four rows, design px (mtscroll.css); measured off the columns below, since wide screens show six
const TAIL = 264; // ground left under the last row when the travel ends, so "See the work" sits under the photos with room above it
const LAG_MAX = 2400;
const END_D = [280, 0, 70]; // (right was 40: Julian, 2026-11-15, "a bit lower") how far each of the three locked columns has dropped behind when the travel ends, design px: mirrors the ends 0.12, 0, 0.2 gave at 1440x900
const DRIFT = [40, 22]; // phone drift caps, px, per column
const FLIP = 1300; // the idle wall's card turn, ms (Julian's pick of 600 / 900 / 1300, 2026-11-17)

type Part = { el: HTMLElement; a: number; c: number; v: number };

type State = { cols: Part[]; figs: Part[]; caps: HTMLElement[]; tw: HTMLElement[]; phs: HTMLElement[]; texts: HTMLElement[]; ctas: HTMLElement | null; more: HTMLElement | null; name: HTMLElement | null; scroll: number; mode: "" | "d" | "p" | "t"; exit: number; unit: number; sizeKey: string; wall: number; out: boolean; drop: number };

const ink = (n: Node) => {
  const r = document.createRange();
  r.selectNodeContents(n);
  return r.getBoundingClientRect();
};

/* Gone, but still there for a screen reader. VoiceOver in Safari scrolls the page far down when it lands on the name (the stage is sticky), and
   visibility:hidden then took the tagline and the buttons out of its tree before its next step: it read the name, then the wall (MAC, 2026-11-17).
   So a gone block is see-through, takes no clicks and leaves the tab order, and nothing more. */
function park(ctas: HTMLElement | null, on: boolean, why: "out" | "past" = "out") {
  if (!ctas) return;
  // two reasons, either is enough: the name has left (out), or the whole hero is above the window (past: a phone's name never leaves)
  ctas.toggleAttribute("data-park-" + why, on);
  const out = ctas.hasAttribute("data-park-out") || ctas.hasAttribute("data-park-past");
  ctas.style.pointerEvents = out ? "none" : "";
  for (const a of ctas.querySelectorAll("a,button")) out ? a.setAttribute("tabindex", "-1") : a.removeAttribute("tabindex");
}

/* Phones and tablets pin the name too (hero.css). `?mtpin=0` brings back the name that scrolls away with the first screen. */
const PIN = !qflag("mtpin", "0");

/* The name's way out, the same on every layout: it rides down out of the window and is over as See the work's top edge enters it.
   2026-11-17, third pass: "too fast, needs to be longer and finish later". It takes the last three quarters of the scroll up to that point,
   a soft start and then an even pace (t*t*(2-t)), not the s-curve whose middle ran at 1.5 times the scroll. */
function sink(st: State, ctx: { vh: number; top: number }) {
  const gap = st.more ? st.more.getBoundingClientRect().top - ctx.vh : 0;
  const t = clamp(1 - gap / Math.max(1, 0.75 * (gap - ctx.top)));
  const e = Math.round(t * t * (2 - t) * 1000) / 1000;
  if (!st.name || e === st.exit) return;
  st.exit = e;
  st.out = e >= 1;
  st.name.style.transform = e ? `translate3d(0,${((st.drop || 0.6 * ctx.vh) * e).toFixed(1)}px,0)` : "";
  st.name.style.setProperty("--mt-out", String(e));
  st.name.style.opacity = st.out ? "0" : "";
  park(st.ctas, st.out);
  // the bar's wordmark comes in as the big name is out, and goes as it comes back (mtscroll.css)
  document.documentElement.toggleAttribute("data-mt-nameout", st.out);
}

/* An unseen margin round the name, the tagline and the buttons (Julian, 2026-11-16: a photo's caption ran through the
   tagline). A caption within PAD of any of them hides (hero.css fades it) and comes back once clear. Held layout only. */
const PAD = 12;

/* The tagline's colour, a letter at a time (Julian, 2026-11-17: black or white with what is under it, grey over the white page; mtscroll.css holds the
   colours). Each wall photo is read once into a 12 by 16 grid of brightness; a letter looks up the cells under it. No blend mode, so no Safari layer rules. */
const GW = 12, GH = 16, LIGHT = 120; // LIGHT: a cell this bright (0 to 255) takes black text
const LUM = new WeakMap<HTMLImageElement, { src: string; g: Uint8ClampedArray | null }>();
function grid(im: HTMLImageElement) {
  if (!im.complete || !im.naturalWidth) return null;
  const src = im.currentSrc || im.src;
  const had = LUM.get(im);
  if (had && had.src === src) return had.g;
  let g: Uint8ClampedArray | null = null;
  try {
    const c = document.createElement("canvas");
    c.width = GW;
    c.height = GH;
    const x = c.getContext("2d", { willReadFrequently: true });
    if (x) {
      x.drawImage(im, 0, 0, GW, GH);
      const d = x.getImageData(0, 0, GW, GH).data;
      g = new Uint8ClampedArray(GW * GH);
      for (let i = 0; i < g.length; i++) g[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
    }
  } catch {
    g = null; // a canvas the browser will not let us read: the word keeps the theme's colour
  }
  LUM.set(im, { src, g });
  return g;
}
let toned = 0, tonedY = -1;
function tone(st: Pick<State, "tw" | "phs">) {
  const wall = st.phs[0]?.closest(".mt-wall");
  if (!st.tw.length || !wall) return;
  /* A pass cost 51 hit tests: 5 to 8ms at 1440, 52ms on a phone-speed CPU, and it ran every frame, idle included (measured on live, 2026-11-17).
     Now ten passes a second at most (the colour takes .15s to change anyway), and a word is hit tested at its two ends: the same photo under both
     is the photo under the whole word. Only a word that straddles two photos goes letter by letter. About 17 hit tests a pass.
     shortcut: a third photo lying on top of a word's middle only is missed, go back to a test a letter if a layout ever does that. */
  const now = performance.now();
  // standing still, only an idle photo swap can change what is under a letter: three passes a second cover that
  if (now - toned < (scrollY === tonedY ? 280 : 100)) return;
  tonedY = scrollY;
  toned = now;
  const rs = st.tw.map((w) => w.getBoundingClientRect());
  /* The photo a visitor sees at this point: a hit test, top first. Scanning the photo boxes took the first box in the document that held the point, and on an
     iPhone that was a photo lying under another one (MAC, #1155: a line stayed white over a pale photo). The name block takes no pointer events, so it is not in the way.
     While a swap develops, the incoming photo counts once it has cut in. Off screen there is nothing to hit: bare page. */
  const hit = (r: DOMRect) =>
    document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).find((n): n is HTMLImageElement => n instanceof HTMLImageElement && wall.contains(n) && n.complete && !!n.naturalWidth && (!n.classList.contains("mt-dev") || n.hasAttribute("data-on"))) ?? null;
  let wd: Element | null = null;
  let same: HTMLImageElement | null | undefined;
  const ts: string[] = [];
  for (let n = 0; n < st.tw.length; n++) {
    const w = st.tw[n], r = rs[n];
    ts[n] = "";
    if (!r.width) continue;
    const cy = r.top + r.height / 2;
    const word = w.parentElement?.classList.contains("wd") ? w.parentElement : null;
    if (!word) same = undefined;
    else if (word !== wd) {
      let z = n;
      while (st.tw[z + 1]?.parentElement === word) z++;
      const a = hit(r);
      same = z === n || a === hit(rs[z]) ? a : undefined;
    }
    wd = word;
    const im = same !== undefined ? same : hit(r);
    let t = "p"; // bare page
    if (im) {
      const g = grid(im);
      if (!g) t = "";
      else {
        // object-fit: cover, centred: where the letter falls in the whole picture
        const b = im.getBoundingClientRect();
        const k = Math.max(b.width / im.naturalWidth, b.height / im.naturalHeight), dw = im.naturalWidth * k, dh = im.naturalHeight * k;
        const at = (x: number) => Math.floor(clamp((x - b.left + (dw - b.width) / 2) / dw, 0, 0.999) * GW);
        const row = Math.floor(clamp((cy - b.top + (dh - b.height) / 2) / dh, 0, 0.999) * GH) * GW;
        const c0 = at(Math.max(r.left, b.left)), c1 = at(Math.min(r.right, b.right));
        let sum = 0;
        for (let c = c0; c <= c1; c++) sum += g[row + c];
        // a letter across the photo's edge belongs to whichever side holds most of it: the hit test alone is off by a pixel there (MAC, #1203)
        t = Math.min(r.right, b.right) - Math.max(r.left, b.left) < r.width / 2 ? "p" : sum / (c1 - c0 + 1) >= LIGHT ? "k" : "w";
      }
    }
    ts[n] = t;
  }
  // one tone per word (Julian, 2026-11-18): a word takes what most of its letters sit on, so it turns whole and never splits black and white.
  // A letter over the bare page, where a word hangs past its photo, keeps the page tone: the photo's white is lost on the light page (QA, #1203).
  const lines = new Map<Element, number[]>();
  rs.forEach((r, n) => {
    const k = st.tw[n].parentElement?.classList.contains("wd") ? st.tw[n].parentElement! : st.tw[n];
    if (r.width) lines.set(k, [...(lines.get(k) ?? []), n]);
  });
  for (const ns of lines.values()) {
    const count: Record<string, number> = {};
    for (const n of ns) if (ts[n] && ts[n] !== "p") count[ts[n]] = (count[ts[n]] ?? 0) + 1;
    const word = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    for (const n of ns) {
      const t = ts[n] === "p" || word === undefined ? ts[n] : word;
      if (st.tw[n].dataset.tone !== t) st.tw[n].dataset.tone = t;
    }
  }
}

function clearance(st: Pick<State, "texts" | "ctas" | "caps">, on: boolean) {
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

// the name block and wall pieces heroStill and the hero driver both read
const parts = (el: HTMLElement) => ({
  caps: [...el.querySelectorAll<HTMLElement>(".mt-col figcaption span")],
  tw: [...el.querySelectorAll<HTMLElement>(".mt-name .mt-cap .w")],
  phs: [...el.querySelectorAll<HTMLElement>(".mt-wall .ph")],
  texts: [...el.querySelectorAll<HTMLElement>(".mt-name h1, .mt-name .mt-cap")],
  ctas: el.querySelector<HTMLElement>(".mt-name .mt-ctas"),
});

/** Reduced motion: the engine is off and nothing moves, so the captions under the name are worked out once and again on resize. */
export function heroStill(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>(".mt-hero");
  if (!el) return () => {};
  const st = parts(el);
  const run = () => (tone(st), clearance(st, true));
  run();
  addEventListener("resize", run);
  const look = window.setInterval(run, 600); // photos still loading: the tagline words read them as they arrive
  return () => (removeEventListener("resize", run), clearInterval(look));
}

export const heroDrivers: Driver[] = [
  {
    name: "hero",
    always: true,
    setup(el) {
      const part = (n: HTMLElement, a: number, c: number): Part => ({ el: n, a, c, v: 0 });
      const st: State = {
        cols: [...el.querySelectorAll<HTMLElement>(".mt-col")].map((n) => part(n, Number(n.dataset.a) || 0, Number(n.dataset.col))),
        figs: [...el.querySelectorAll<HTMLElement>(".mt-col:not(.side) figure")].map((n) => part(n, 0, Number(n.style.getPropertyValue("--c2")) || 0)),
        ...parts(el),
        more: el.querySelector<HTMLElement>(".mt-more .btn"),
        name: el.querySelector<HTMLElement>("[data-mt-name]"),
        scroll: -1,
        mode: "",
        exit: -1,
        unit: 0,
        sizeKey: "",
        wall: WALL,
        out: false,
        drop: 0,
      };
      // "off": the hero runs and no name flies to the bar, so mtscroll.css keeps the bar's wordmark hidden until the name leaves
      document.documentElement.setAttribute("data-mtdock", "off");
      // by scroll, not by frame: a jump past the hero gets no hero frames
      // the hero is over when its last photos have left from under the header: the same line going down and coming back up
      const hdr = document.querySelector<HTMLElement>(".site-hdr");
      /* The wall's links leave the tab order once the name has left (a phone, whose name never leaves: once the first screen is above the header).
         Tab from the header went to the first wall photo and pulled the page back to the top (MAC, #1157), also partway through the hero, with its
         bottom still showing (MAC, #1160). All of them at once: a link at a time was tried, and focus on a photo inside the pinned stage still
         scrolled the page. See the work stays until the whole hero is past. The buttons go through park.
         shortcut: Shift+Tab from further down skips the wall; scroll back to the top and its links return. */
      const links = () => el.querySelectorAll<HTMLElement>(".mt-wall a, .mt-more a"); // read when needed: the wall swaps its photos
      let due = 0;
      const sweep = () => {
        due = 0;
        const top = hdr?.offsetHeight ?? 60, c = st.ctas;
        const over = el.getBoundingClientRect().bottom <= top, up = !!c && c.getBoundingClientRect().bottom <= top;
        const wall = over || up || !!c?.hasAttribute("data-park-out");
        for (const a of links()) {
          const off = a.closest(".mt-more") ? over : wall;
          if ((a.getAttribute("tabindex") === "-1") !== off) off ? a.setAttribute("tabindex", "-1") : a.removeAttribute("tabindex");
        }
        park(c, over || up, "past");
      };
      const past = () => {
        document.documentElement.toggleAttribute("data-mt-pasthero", el.getBoundingClientRect().bottom <= (hdr?.offsetHeight ?? 60));
        if (!due) due = window.setTimeout(sweep, 100); // ten sweeps a second while scrolling, and one after the last scroll event
      };
      if (!PIN) document.documentElement.setAttribute("data-mt-nopin", "");
      // The idle wall turns a card over to its next photo (hero.css). The value is the duration: hero.tsx reads it for the caption. `?mtflip=0` brings the hard cut back.
      const flip = qflag("mtflip", "0") ? 0 : FLIP;
      const ac = new AbortController();
      if (flip) {
        document.documentElement.setAttribute("data-mt-flip", String(flip));
        document.documentElement.style.setProperty("--mt-flip", flip + "ms");
      }
      // always: phones keep the wordmark out of the bar while the hero is on screen (mtscroll.css)
      addEventListener("scroll", past, { passive: true, signal: ac.signal });
      past();
      const look = window.setInterval(() => tone(st), 300); // the idle wall swaps a photo with no frame running
      const off = () => {
        clearInterval(look);
        ac.abort();
        document.documentElement.removeAttribute("data-mt-nopin");
        document.documentElement.removeAttribute("data-mt-flip");
        document.documentElement.style.removeProperty("--mt-flip");
        document.documentElement.removeAttribute("data-mt-pasthero");
        clearTimeout(due);
        for (const a of links()) a.removeAttribute("tabindex");
        park(st.ctas, false, "past");
        document.documentElement.removeAttribute("data-mt-nameout");
        [...st.cols, ...st.figs].forEach((p) => (p.el.style.transform = ""));
        if (st.name) st.name.style.cssText = "";
        park(st.ctas, false);
        tone(st);
        clearance(st, false);
        document.documentElement.removeAttribute("data-mtdock");
      };
      return { frame: (p, el, ctx) => heroFrame(st, p, el, ctx), off };
    },
  },
];

function heroFrame(st: State, p: number, el: HTMLElement, ctx: Ctx) {
  const mode = ctx.held ? "d" : ctx.vw < 600 ? "p" : "t";
  if (mode !== st.mode) {
    st.mode = mode;
    st.scroll = -1;
    st.exit = -1;
    [...st.cols, ...st.figs].forEach((x) => move(x, 0));
    if (st.name) st.name.style.cssText = "";
    park(st.ctas, false);
    document.documentElement.removeAttribute("data-mt-nameout");
    tone(st);
    clearance(st, false);
    st.sizeKey = "";
  }

  if (mode === "d") {
    // the wall's own unit: big screens fit more columns by shrinking it (mtscroll.css), so measure it off a column, once a size
    const at = ctx.vw + "x" + ctx.vh;
    if (at !== st.sizeKey) {
      st.sizeKey = at;
      const core = st.cols.filter((c) => !c.el.classList.contains("side"));
      st.unit = (core[0]?.el.offsetWidth ?? 0) / 403 || ctx.u;
      // the lowest column end plus the 46 design px under it: 2640 with four rows
      st.wall = core.length ? Math.max(...core.map((c) => c.el.offsetTop + c.el.offsetHeight)) / st.unit + 46 : WALL;
      // how far the name has to sink to clear the window: from its top at rest to the window's lower edge, and 24px. It rode
      // 0.6 of the window, and was out of sight well before the ride was over (Julian, 2026-11-17: "even longer, almost right before" the button)
      if (st.texts[0]) st.drop = ctx.vh - (st.texts[0].getBoundingClientRect().top - Math.max(0, st.exit) * st.drop) + 24;
    }
    const u = st.unit;
    // the ground under the last row is in the page's unit, like the button that sits in it
    const target = p * Math.max(0, st.wall * u + TAIL * ctx.u - Math.max(ctx.vh, 600));
    // a 0.64 follow (0.4 until Julian halved the delay a second time, 2026-11-17), frame-rate independent (the live Recent()'s 0.2 felt laggy here: Julian, 2026-11-17, "half the delay")
    st.scroll = st.scroll < 0 || Math.abs(target - st.scroll) < 0.1 ? target : st.scroll + (target - st.scroll) * (1 - Math.pow(0.36, ctx.dt / 16.7));
    const S = st.scroll;
    /* Where the wall ends (Julian, 2026-11-15): with three columns the left one ends lowest and the right one
       highest, a stair down to the left, so "See the work" on the right has the open corner. The markup's lags
       ended it the other way round. Five and seven columns already end high on the right, so they keep theirs. */
    const three = ctx.vw < 1920;
    // a share of the travel, not of the distance: a tall window travels less and must still end on the same stair
    const share = S / Math.max(1, st.wall * u + TAIL * ctx.u - Math.max(ctx.vh, 600));
    for (const c of st.cols) move(c, -(S - (three && c.c in END_D ? share * END_D[c.c] * u : Math.min(S, LAG_MAX * u) * c.a * 0.5)));
    /* Julian, 2026-11-16: "it needs to stay in place until 3 rows are scrolled and move down and out". The name
       holds until the fourth row is whole in the window (its lower edge at the window's: "pinned to screen for
       3-4 rows"), then rides down out of the window. 2026-11-17: "too quick, it needs to go out a bit slower with parallax": the ride takes
       0.8 of a row, and the tagline and buttons sink ahead of the name (--mt-out, hero.css). Never later than the travel allows. */
    // 2026-11-17, third pass: "too fast, needs to be longer and finish later". The ride is read off See the work: it is
    // over as the button's top edge enters the window, and takes the last three quarters of the scroll up to that point.
    // A soft start and then an even pace (t*t*(2-t)), not the s-curve whose middle ran at 1.5 times the scroll.
    sink(st, ctx);
    tone(st);
    clearance(st, !st.out);
    return;
  }

  // the columns lead upward, so nothing runs past the bottom of the wall
  const gone = clamp(-ctx.top, 0, LAG_MAX);
  if (mode === "p") for (const f of st.figs) move(f, -DRIFT[f.c] * clamp(gone / Math.max(1, ctx.h)));
  else for (const c of st.cols) move(c, -gone * c.a * 0.5 * (ctx.vw / 1440));
  /* Phones and tablets: the name block is sticky (hero.css), so it holds while the wall scrolls under it, then sinks out the desktop's way.
     Julian, 2026-11-18: it scrolled away with the first screen. How far it sinks: from the name's top to the window's lower edge, and 24px. */
  if (PIN && st.name && st.texts[0] && ctx.vw + "x" + ctx.vh !== st.sizeKey) {
    st.sizeKey = ctx.vw + "x" + ctx.vh;
    const b = st.name.getBoundingClientRect();
    st.drop = b.height - (st.texts[0].getBoundingClientRect().top - b.top) + 24;
  }
  if (PIN) sink(st, ctx);
  // phones and tablets too: captions ran through the name and tagline (MAC, 2026-11-17). Only while the name is on screen.
  const on = PIN ? !st.out && el.getBoundingClientRect().bottom > 0 : -ctx.top < ctx.vh; // read before tone, as before the split
  tone(st);
  clearance(st, on);
}
