import { scrollGoal, settleTo, shiftScroll } from "@/components/site/smooth-scroll";
import { matches } from "@/lib/device";
import { holdEase as ease, holdUnease as unease } from "@/lib/motion/hold-ease";
import { captionsOff, vimeoListen, vimeoPlays } from "@/lib/work/videos";
import { clamp, rise, smooth, tell, type Ctx, type Driver } from "./engine";
import { sleeveTilt } from "@/components/cover/sleeve-tilt";


/* Snap: a hold never rests between two items. When the scroll stops inside the hold, the page glides to the
   nearest one. Within a step of the item it rested on it leans 0.44 of a step the way the scroll went, so one wheel notch (100px, a small part of a step) moves on instead of
   falling back. `at`: the hold's share as an item position; `share`: an item's resting share of the hold. */
const LEAN = 0.44;
function snap(el: HTMLElement, ctx: Ctx, n: number, at: (p: number) => number, share: (i: number) => number, busy: () => boolean, signal: AbortSignal) {
  if (matches("calm")) return;
  let t = 0, rest = NaN; // the item position the page last settled on; NaN outside the hold, so arriving is plain nearest
  const settle = () => {
    // fine pointers only: a finger's own momentum is left alone (MAC, #1209: the iPad snapped too)
    if (!ctx.held || !ctx.fine || busy()) return;
    const top = el.getBoundingClientRect().top + scrollY, range = el.offsetHeight - innerHeight, y = scrollGoal(), p = (y - top) / range;
    // the two ends are items too: resting exactly there keeps `rest`, a pixel past them the page is free
    if (y < top - 1 || y > top + range + 1) return void (rest = NaN);
    const f = at(p), i = clamp(Math.round(f + (Math.abs(f - rest) < 1 ? Math.sign(f - rest) * LEAN : 0)), 0, n - 1), to = top + share(i) * range;
    rest = i;
    // 1px: scrollY is fractional, an exact compare would glide forever
    if (Math.abs(to - y) > 1) settleTo(to);
  };
  const on = () => {
    clearTimeout(t);
    t = window.setTimeout(settle, 140);
  };
  // wheel: the glide starts when the hand stops, not when Lenis's long tail does. scroll: keys, the scrollbar, touch.
  addEventListener("wheel", on, { passive: true, signal });
  addEventListener("scroll", on, { passive: true, signal });
  signal.addEventListener("abort", () => clearTimeout(t));
}

/* Cover art (spec 3.7): on the desktop structure the page scroll walks the row
   sideways. Motion (spec 3.8): a vertical stack there, see films() below.
   Everywhere else the native snap rows stay. */

/** What covers() keeps between frames: the row's measure, the item it last stepped to, and a drag in progress. */
type Covers = {
  el: HTMLElement;
  ctx: Ctx;
  row: HTMLElement;
  track: HTMLElement;
  items: HTMLElement[];
  n: number;
  o: number[];
  step: number;
  c0: number;
  mid: number;
  range: number;
  cur: number;
  base: number;
  lastX: number;
  down: number | null;
  downY: number;
  dragged: boolean;
};
const MILLI = 1000; // --o is kept to three decimals

function measureCovers(s: Covers) {
  const { row, items } = s;
  // flow.css scales the row as it enters and settles: measure it at rest
  row.style.transform = "none";
  const a = items[0].getBoundingClientRect();
  s.step = items[1].getBoundingClientRect().left - a.left;
  s.c0 = row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).paddingLeft) + a.width / 2;
  s.mid = innerWidth / 2;
  s.range = s.el.offsetHeight - innerHeight;
  row.style.transform = "";
  s.cur = -1;
  s.lastX = NaN;
}

/* Record rule: out at the stage centre, back in the sleeve `fall` px away. */
function discs(s: Covers, x: number, fall: number, k = 1) {
  const { o, items } = s;
  for (let i = 0; i < s.n; i++) {
    // eased: the record leaves and returns slowly at both ends instead of at one speed
    const v = Math.round(smooth(clamp(1 - Math.abs(s.c0 + i * s.step - x - s.mid) / fall)) * k * MILLI) / MILLI;
    if (v !== o[i]) items[i].style.setProperty("--o", String((o[i] = v)));
  }
}

// Snap rows: the disc only exists on the current sleeve, which changes at half a step, so it is back in by then.
function loose(s: Covers) {
  if (!s.ctx.held) discs(s, s.row.scrollLeft, s.step / 2);
}

function coverFrame(s: Covers, p: number) {
  const { n, step } = s;
  // the first record starts inside its sleeve and comes out over the first 5% of the hold
  const k = smooth(clamp(p / 0.05));
  p = ease(p);
  const i = Math.round(p * (n - 1)), x = p * (n - 1) * step;
  if (i !== s.cur) {
    // HomeCovers (rows.tsx) is told the item; the row's scroll stays at 0 and the transform carries all of it.
    tell(s.el, { cur: i });
    s.base = s.row.scrollLeft;
    s.cur = i;
  } else if (x === s.lastX) return;
  s.lastX = x;
  s.track.style.transform = `translate3d(${(s.base - x).toFixed(2)}px,0,0)`;
  // 420 of the 520 design px between covers; by the measured step, so it holds where the covers stand closer (tall windows)
  discs(s, x, step * (420 / 520), k);
}

// The title line rises when HomeCovers (rows.tsx) commits the new item (on touch too). A turned sleeve turns back.
function coverTold(s: Covers) {
  for (const it of s.items) it.removeAttribute("data-tp-fl");
  rise(s.el.querySelector(".mt-ttl .ln > span"));
}

/* Sideways drag moves the page scroll, so the two never disagree. */
const coverTop = (s: Covers) => s.el.getBoundingClientRect().top + scrollY;

function dragStart(s: Covers, e: PointerEvent) {
  if (!s.ctx.held || e.button) return;
  s.down = e.clientX;
  s.downY = scrollY;
  s.dragged = false;
}

function dragMove(s: Covers, e: PointerEvent) {
  if (s.down === null) return;
  if (!e.buttons) return void (s.down = null);
  const dx = e.clientX - s.down;
  if (!s.dragged && Math.abs(dx) < 6) return;
  if (!s.dragged) s.row.setPointerCapture(e.pointerId);
  s.dragged = true;
  // From the drag's start, not step by step: scrollY rounds and the error would add up.
  const t = coverTop(s);
  shiftScroll(clamp(s.downY - (dx * s.range) / ((s.n - 1) * s.step), t, t + s.range) - scrollY);
}

// a cancelled drag gets no click to clear `dragged`, which would keep the hover tilt off until the next press
function dragCancel(s: Covers) {
  s.down = null;
  s.dragged = false;
}

function dragClick(s: Covers, e: MouseEvent) {
  if (!s.dragged) return;
  s.dragged = false;
  e.preventDefault();
  e.stopPropagation();
}

// Tab to a cover: the browser scrolls the hidden row to show it. Put that back and move the page there instead.
function coverFocus(s: Covers, e: FocusEvent) {
  const t = e.target as Element, it = t.closest<HTMLElement>(".mt-item"), i = it ? s.items.indexOf(it) : -1;
  if (!s.ctx.held || i < 0 || !t.matches(":focus-visible")) return;
  s.row.scrollLeft = s.base;
  shiftScroll(coverTop(s) + unease(i / (s.n - 1)) * s.range - scrollY);
}

// Left and right step one item, to that item's own place in the hold (the shares are uneven), and stop at the ends.
function coverKey(s: Covers, e: KeyboardEvent) {
  if (!s.ctx.held || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
  e.preventDefault();
  const at = Math.max(0, s.cur), i = clamp(at + (e.key === "ArrowRight" ? 1 : -1), 0, s.n - 1);
  if (i !== at) scrollTo({ top: coverTop(s) + unease(i / (s.n - 1)) * s.range, behavior: "smooth" });
}

// a tap turns a sleeve with a back over, a second tap turns it back (touch-parity.css), one sleeve at a time (MAC, #1212: two stayed turned in the phone's side row). Mouse pointers flip on hover instead.
function flip(s: Covers, it: HTMLElement) {
  if (s.ctx.fine) return;
  for (const o of s.items) if (o !== it) o.removeAttribute("data-tp-fl");
  it.toggleAttribute("data-tp-fl");
}

// After the engine's own resize pass, so ctx is current.
function coverResize(s: Covers) {
  const was = s.cur; // measureCovers() resets it
  measureCovers(s);
  if (s.ctx.held) return;
  if (was > 0) s.row.scrollLeft = was * s.step; // the row rested at 0 while held; land it on the told item
  s.track.style.transform = "";
  loose(s);
}

function coversOff(s: Covers, ac: AbortController, mo: MutationObserver) {
  ac.abort();
  mo.disconnect();
  s.track.style.transform = "";
  for (const k of ["data-mt-par", "data-mt-lid"]) document.documentElement.removeAttribute(k);
  for (const it of s.items) {
    it.classList.remove("hv");
    it.style.setProperty("--o", "0.5");
  }
}

function covers(): Driver {
  return {
    name: "covers",
    setup(el, ctx) {
      const row = el.querySelector<HTMLElement>(".mt-row");
      if (!row) return;
      const track = row.firstElementChild as HTMLElement;
      const items = [...track.children] as HTMLElement[];
      const n = items.length;
      if (n < 2) return;
      const ac = new AbortController();
      const opts = { signal: ac.signal };
      const s: Covers = { el, ctx, row, track, items, n, o: Array(n).fill(-1), step: 1, c0: 0, mid: 0, range: 0, cur: -1, base: 0, lastX: NaN, down: null, downY: 0, dragged: false };

      /* Parallax: the heading and the row ride up at their own rates and the stage hands over to Motion (rows.css). */
      document.documentElement.setAttribute("data-mt-par", "");
      // the lid: Cover art waits under Commissions, which lifts off it like a lid (rows.css)
      document.documentElement.setAttribute("data-mt-lid", "");

      const mo = new MutationObserver(() => coverTold(s));
      mo.observe(el, { attributeFilter: ["data-cur"] });

      row.addEventListener("pointerdown", (e) => dragStart(s, e), opts);
      row.addEventListener("pointermove", (e) => dragMove(s, e), opts);
      row.addEventListener("pointerup", () => void (s.down = null), opts);
      row.addEventListener("pointercancel", () => dragCancel(s), opts);
      row.addEventListener("click", (e) => dragClick(s, e), { capture: true, signal: ac.signal });
      row.addEventListener("dragstart", (e) => void (ctx.held && e.preventDefault()), opts);
      row.addEventListener("focusin", (e) => coverFocus(s, e), opts);
      row.addEventListener("keydown", (e) => coverKey(s, e), opts);
      row.addEventListener("scroll", () => loose(s), { passive: true, signal: ac.signal });
      snap(el, ctx, n, (p) => ease(p) * (n - 1), (i) => unease(i / (n - 1)), () => s.down !== null, ac.signal);

      for (const it of items) if (it.hasAttribute("data-flip")) it.addEventListener("click", () => flip(s, it), opts);

      /* Hover lift (fine pointers): tilt toward the pointer, up to 9deg each way. rows.css does the rest. */
      for (const it of items) sleeveTilt(it, () => ctx.held && ctx.fine && !s.dragged, opts);

      addEventListener("resize", () => requestAnimationFrame(() => coverResize(s)), opts);

      measureCovers(s);
      loose(s);
      return { frame: (p: number) => coverFrame(s, p), off: () => coversOff(s, ac, mo) };
    },
  };
}

/* Previews: a muted player in the current film, and one in the film before and after it, started and
   then paused so they are loaded when their turn comes. The poster stays on top
   until the player says it plays (same wait as video.tsx Loop). Players only ever start while the
   page rests, the current film's first, the others one at a time. */
type Pv = { f: HTMLIFrameElement | HTMLVideoElement; yt: boolean; played: boolean; at: number; t: number };
/** What films() keeps: the current film, its players, and when the page last moved. */
type Films = {
  el: HTMLElement;
  ctx: Ctx;
  row: HTMLElement;
  items: HTMLElement[];
  n: number;
  cur: number;
  pool: Map<number, Pv>;
  pvT: number;
  seen: boolean;
  movedAt: number;
  touchFilms: boolean;
};
// YouTube: onStateChange carries the state as `info`, infoDelivery as `info.playerState`; Vimeo: playProgress `data.seconds`
type PlayerMsg = { event?: string; info?: number | { playerState?: number }; data?: { seconds?: number } };

const win = (v: Pv) => (v.f instanceof HTMLIFrameElement ? v.f.contentWindow : null);
const say = (v: Pv, yt: string, vimeo: string) =>
  v.f instanceof HTMLVideoElement ? void (vimeo === "play" ? v.f.play().catch(() => {}) : v.f.pause()) : v.f.contentWindow?.postMessage(JSON.stringify(v.yt ? { event: "command", func: yt, args: [] } : { method: vimeo }), "*");

function kill(s: Films, i: number) {
  const v = s.pool.get(i);
  if (!v) return;
  clearTimeout(v.t);
  v.f.remove();
  s.pool.delete(i);
}

function drop(s: Films) {
  clearTimeout(s.pvT);
  for (const i of [...s.pool.keys()]) kill(s, i);
}

/* The site's own file (lib/home/data.ts FILM_FILES): a plain video, no player to wait for. It says "playing" itself. */
function mountFile(s: Films, i: number, film: HTMLElement, file: string) {
  const f = document.createElement("video");
  const v: Pv = { f, yt: false, played: false, at: performance.now(), t: 0 };
  Object.assign(f, { muted: true, loop: true, playsInline: true, autoplay: true, preload: "auto", tabIndex: -1, src: file });
  f.setAttribute("aria-hidden", "true");
  f.addEventListener("playing", () => {
    v.played = true;
    if (i !== s.cur) f.pause();
    else f.setAttribute("data-ready", "");
  });
  film.append(f);
  s.pool.set(i, v);
}

function mount(s: Films, i: number) {
  const film = s.items[i], src = film.dataset.preview ?? "";
  if (film.dataset.file) return mountFile(s, i, film, film.dataset.file);
  const yt = src.includes("youtube");
  const f = document.createElement("iframe");
  const v: Pv = { f, yt, played: false, at: performance.now(), t: 0 };
  f.src = src + (yt ? "&enablejsapi=1" : "");
  // YouTube picks its quality from the player's size and ignores a quality setting (720p at 1440 wide, measured): rows.css draws it at twice the size, scaled back
  if (yt) f.setAttribute("data-big", "");
  f.allow = "autoplay";
  f.tabIndex = -1;
  f.setAttribute("aria-hidden", "true");
  f.onload = () => {
    if (!yt) return void vimeoListen(f.contentWindow);
    f.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
    captionsOff(f.contentWindow);
  };
  film.append(f);
  s.pool.set(i, v);
}

const wants = (s: Films, i: number) => i >= 0 && i < s.n && !!s.items[i].dataset.preview && !s.pool.has(i);

function fill(s: Films) {
  const { cur, items } = s;
  // on touch only the film in view loads: no neighbours on a phone's data
  const next = (s.ctx.held ? [cur, cur + 1, cur - 1] : [cur]).find((i) => wants(s, i));
  if (next === undefined) return;
  // a player takes about 300ms of the graphics thread to start: never start one mid-scroll. "Resting" is 600ms
  // with no scroll at all (between two wheel notches the page is still for a moment). The site's own file costs nothing: at once.
  if (!items[next].dataset.file && performance.now() - s.movedAt < 600) return void (s.pvT = window.setTimeout(() => fill(s), 200));
  // a neighbour waits until every player already here plays (or has had 6s: a blocked one never will)
  const busy = [...s.pool.values()].some((v) => !v.played && performance.now() - v.at < 6000);
  if (next !== cur && busy) return void (s.pvT = window.setTimeout(() => fill(s), 400));
  mount(s, next);
  s.pvT = window.setTimeout(() => fill(s), 400);
}

function preview(s: Films) {
  const { cur } = s;
  clearTimeout(s.pvT);
  if (!s.seen || !(s.ctx.held || s.touchFilms)) return drop(s);
  for (const [i, v] of [...s.pool]) {
    if (Math.abs(i - cur) > 1) kill(s, i);
    else if (i !== cur) {
      clearTimeout(v.t);
      v.f.removeAttribute("data-ready");
      if (v.played) say(v, "pauseVideo", "pause");
    } else if (v.played) say(v, "playVideo", "play");
  }
  s.pvT = window.setTimeout(() => fill(s), wants(s, cur) && s.items[cur].dataset.file ? 0 : 300);
}

// null when the string is not JSON
function parse(data: unknown): { m: PlayerMsg | undefined } | null {
  try {
    return { m: typeof data === "string" ? JSON.parse(data) : (data as PlayerMsg | undefined) };
  } catch {
    return null;
  }
}

function heard(s: Films, e: MessageEvent) {
  const hit = [...s.pool].find(([, v]) => win(v) === e.source);
  if (!hit) return;
  const [i, v] = hit;
  const got = parse(e.data);
  if (!got) return;
  const { m } = got;
  // Vimeo: the poster lifts only when the player says frames are moving
  if (m?.event === "ready") return void vimeoListen(win(v));
  const state = m?.event === "onStateChange" ? m.info : m?.event === "infoDelivery" && m.info && typeof m.info === "object" ? m.info.playerState : undefined;
  const plays = vimeoPlays(m) || state === 1;
  if (!plays && typeof state !== "number") return;
  if (plays) {
    const first = !v.played;
    v.played = true;
    if (state === 1) captionsOff(win(v));
    if (i !== s.cur) return void say(v, "pauseVideo", "pause");
    if (v.f.hasAttribute("data-ready") || v.t) return;
    // YouTube draws its own title and controls for a moment after a first start; a loaded one resumes clean
    v.t = window.setTimeout(() => ((v.t = 0), v.f.setAttribute("data-ready", "")), v.yt ? (first ? 2500 : 350) : 0);
  } else if (i === s.cur && state !== 2) {
    clearTimeout(v.t);
    v.t = 0;
    v.f.removeAttribute("data-ready");
  }
}

// held, the row does not scroll itself, the page does: left and right step the page one film's share of the hold
function filmKey(s: Films, e: KeyboardEvent) {
  if (!s.ctx.held || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
  e.preventDefault();
  scrollBy({ top: ((s.el.offsetHeight - innerHeight) / s.n) * (e.key === "ArrowRight" ? 1 : -1), behavior: "smooth" });
}

// rows.tsx names the current film; its preview follows and the title line rises.
function filmTold(s: Films) {
  s.cur = +(s.el.dataset.cur ?? 0);
  preview(s);
  if (s.ctx.held || s.touchFilms) rise(s.el.querySelector(".mt-ttl .ln > span"));
}

// The row does not scroll here, so it is not a tab stop of its own.
const tab = (s: Films) => void (s.row.tabIndex = s.ctx.held ? -1 : 0);

function filmResize(s: Films) {
  tab(s);
  if (!s.ctx.held && !s.touchFilms) drop(s); // a phone's toolbar resizes the window as it scrolls
}

function filmsOff(s: Films, ac: AbortController, mo: MutationObserver, io: IntersectionObserver) {
  ac.abort();
  mo.disconnect();
  io.disconnect();
  drop(s);
  s.row.tabIndex = 0;
}

/* Motion on the desktop structure: the films share one screen and rows.tsx
   picks the current one from the hold. Only the muted preview lives here. */
function films(): Driver {
  return {
    name: "motion",
    setup(el, ctx) {
      const row = el.querySelector<HTMLElement>(".mt-row");
      if (!row) return;
      const items = [...el.querySelectorAll<HTMLElement>(".mt-film")];
      const n = items.length;
      if (n < 2) return;
      const ac = new AbortController();
      const opts = { signal: ac.signal };
      // phones and tablets play the current film's preview too, unless the visitor asked to save data
      const s: Films = { el, ctx, row, items, n, cur: +(el.dataset.cur ?? 0), pool: new Map(), pvT: 0, seen: false, movedAt: 0, touchFilms: false };
      // each film rests at the middle of its share of the hold; the shares are eased like Cover art's (rows.tsx)
      snap(el, ctx, n, (p) => ease(p) * n - 0.5, (i) => unease((i + 0.5) / n), () => false, ac.signal);
      row.addEventListener("keydown", (e) => filmKey(s, e), opts);
      addEventListener("scroll", () => (s.movedAt = performance.now()), { passive: true, signal: ac.signal });
      s.touchFilms = !navigator.connection?.saveData;
      addEventListener("message", (e) => heard(s, e), opts);
      // a screen early, so the first film is already playing when the section arrives
      const io = new IntersectionObserver(([e]) => ((s.seen = e.isIntersecting), preview(s)), { rootMargin: "100% 0px" });
      io.observe(el);
      const mo = new MutationObserver(() => filmTold(s));
      mo.observe(el, { attributeFilter: ["data-cur"] });
      addEventListener("resize", () => requestAnimationFrame(() => filmResize(s)), opts);
      tab(s);
      return () => filmsOff(s, ac, mo, io);
    },
  };
}

export const rowsDrivers: Driver[] = [covers(), films()];
