import { scrollGoal, settleTo } from "@/components/site/smooth-scroll";
import { matches } from "@/lib/device";
import { holdEase as ease, holdUnease as unease } from "@/lib/motion/hold-ease";
import { captionsOff, vimeoListen, vimeoPlays } from "@/lib/work/videos";
import { clamp, rise, type Ctx, type Driver } from "./engine";

/* Snap: a hold never rests between two items. When the scroll stops inside the hold, the page glides to the
   nearest one. Within a step of the item it rested on it leans 0.44 of a step the way the scroll went, so one wheel notch (100px, a small part of a step) moves on instead of
   falling back. `at`: the hold's share as an item position; `share`: an item's resting share of the hold. */
const LEAN = 0.44;
function snap(
  el: HTMLElement,
  ctx: Ctx,
  n: number,
  at: (p: number) => number,
  share: (i: number) => number,
  busy: () => boolean,
  signal: AbortSignal,
) {
  if (matches("calm")) return;
  let t = 0,
    rest = NaN; // the item position the page last settled on; NaN outside the hold, so arriving is plain nearest
  const settle = () => {
    // fine pointers only: a finger's own momentum is left alone, on an iPad too
    if (!ctx.held || !ctx.fine || busy()) return;
    const top = el.getBoundingClientRect().top + scrollY,
      range = el.offsetHeight - innerHeight,
      y = scrollGoal(),
      p = (y - top) / range;
    // the two ends are items too: resting exactly there keeps `rest`, a pixel past them the page is free
    if (y < top - 1 || y > top + range + 1) return void (rest = NaN);
    const f = at(p),
      i = clamp(Math.round(f + (Math.abs(f - rest) < 1 ? Math.sign(f - rest) * LEAN : 0)), 0, n - 1),
      to = top + share(i) * range;
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

type Pv = { player: HTMLIFrameElement | HTMLVideoElement; isYoutube: boolean; played: boolean; startAt: number; timer: number };
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

const win = (v: Pv) => (v.player instanceof HTMLIFrameElement ? v.player.contentWindow : null);
const say = (v: Pv, yt: string, vimeo: string) =>
  v.player instanceof HTMLVideoElement
    ? void (vimeo === "play" ? v.player.play().catch(() => {}) : v.player.pause())
    : v.player.contentWindow?.postMessage(JSON.stringify(v.isYoutube ? { event: "command", func: yt, args: [] } : { method: vimeo }), "*");

function kill(s: Films, i: number) {
  const v = s.pool.get(i);
  if (!v) return;
  clearTimeout(v.timer);
  v.player.remove();
  s.pool.delete(i);
}

function drop(s: Films) {
  clearTimeout(s.pvT);
  for (const i of [...s.pool.keys()]) kill(s, i);
}

/* The site's own file (lib/home/data.ts FILM_FILES): a plain video, no player to wait for. It says "playing" itself. */
function mountFile(s: Films, i: number, film: HTMLElement, file: string) {
  const f = document.createElement("video");
  const v: Pv = { player: f, isYoutube: false, played: false, startAt: performance.now(), timer: 0 };
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
  const film = s.items[i],
    src = film.dataset.preview ?? "";
  if (film.dataset.file) return mountFile(s, i, film, film.dataset.file);
  const yt = src.includes("youtube");
  const f = document.createElement("iframe");
  const v: Pv = { player: f, isYoutube: yt, played: false, startAt: performance.now(), timer: 0 };
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
  const busy = [...s.pool.values()].some((v) => !v.played && performance.now() - v.startAt < 6000);
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
      clearTimeout(v.timer);
      v.player.removeAttribute("data-ready");
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
  const state =
    m?.event === "onStateChange"
      ? m.info
      : m?.event === "infoDelivery" && m.info && typeof m.info === "object"
        ? m.info.playerState
        : undefined;
  const plays = vimeoPlays(m) || state === 1;
  if (!plays && typeof state !== "number") return;
  if (plays) {
    const first = !v.played;
    v.played = true;
    if (state === 1) captionsOff(win(v));
    if (i !== s.cur) return void say(v, "pauseVideo", "pause");
    if (v.player.hasAttribute("data-ready") || v.timer) return;
    // YouTube draws its own title and controls for a moment after a first start; a loaded one resumes clean
    v.timer = window.setTimeout(() => ((v.timer = 0), v.player.setAttribute("data-ready", "")), v.isYoutube ? (first ? 2500 : 350) : 0);
  } else if (i === s.cur && state !== 2) {
    clearTimeout(v.timer);
    v.timer = 0;
    v.player.removeAttribute("data-ready");
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
      const s: Films = {
        el,
        ctx,
        row,
        items,
        n,
        cur: +(el.dataset.cur ?? 0),
        pool: new Map(),
        pvT: 0,
        seen: false,
        movedAt: 0,
        touchFilms: false,
      };
      // each film rests at the middle of its share of the hold; the shares are eased like Cover art's (rows.tsx)
      snap(
        el,
        ctx,
        n,
        (p) => ease(p) * n - 0.5,
        (i) => unease((i + 0.5) / n),
        () => false,
        ac.signal,
      );
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

export const rowsDrivers: Driver[] = [films()];
