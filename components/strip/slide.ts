import { GESTURE_GAP_MS } from "./shared";

/* ── the homepage strip's own wheel (`?scroll=1`) ──────────────────
 * Julian, 2026-10-22: the strip as default was laggy and the scroll not
 * smooth. Lenis chased every event, and every screen's contents moved
 * with the slide. Here the wheel plays one fixed slide instead, and only
 * the strip moves: its screens are shifted by a transform on the
 * compositor, and the scroll jumps to the new screen in the frame the
 * slide ends, so nothing scrolls, restyles or re-renders on the way.
 *
 * - A mouse: a page turns at a notch and a half of wheel. Less nudges
 *   the strip a little and it settles back. While a turn plays, the
 *   wheel is ignored, so turns never stack.
 * - A trackpad: the strip follows the fingers one to one, and once they
 *   let go (the momentum falling away, or the stream stopping) the
 *   same slide finishes the move.
 *
 * `wheel.ts` hands over here once it has dealt with inner boxes, the
 * ends and the crossings, so those stay as they are.
 * ─────────────────────────────────────────────────────────────── */

export type FlatSlide = { wheel: (dy: number, pad: boolean, at: number) => void };
export const flatSlide = new WeakMap<HTMLElement, FlatSlide>();

/** Two notches, counted as wheel events, not pixels: Safari's notch is
    far smaller than Chrome's 100, and 150px took four of them (MAC). */
const TURN = 2;
const SLIDE_MS = 650;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function slideStrip(el: HTMLElement) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  let busy = false;
  let shifting: Animation[] = [];
  let nudgeX = 0;
  let acc = 0;
  let accAt = -Infinity;
  let rest = 0;
  // A trackpad's push: its speed (px per ms), its peak, and whether it has let go.
  let padAt = -Infinity;
  let padV = 0;
  let padPeak = 0;
  let padPrev = 0;
  let padFall = 0;
  let padNet = 0;
  let padGone = false;

  const room = () => el.scrollWidth - el.clientWidth;
  const stops = () => {
    const cs = getComputedStyle(el);
    const gap = parseFloat(cs.columnGap) || 0;
    const end = room();
    const out: number[] = [];
    let at = parseFloat(cs.paddingLeft) || 0;
    for (const k of Array.from(el.children) as HTMLElement[]) {
      out.push(Math.min(end, at));
      at += k.offsetWidth + gap;
    }
    return out;
  };

  /** Every screen shifted from `from` to `to` px along, on the compositor. */
  const shift = (from: number, to: number, ms: number) => {
    const next = (Array.from(el.children) as HTMLElement[]).map((k) =>
      k.animate([{ transform: `translateX(${-from}px)` }, { transform: `translateX(${-to}px)` }], {
        duration: ms,
        easing: EASE,
        fill: "forwards",
      }),
    );
    // The new ones first, then the old ones off: no frame without either.
    for (const a of shifting) a.cancel();
    shifting = next;
    return next;
  };

  const nudge = (x: number, ms: number) => {
    if (x === nudgeX) return;
    shift(nudgeX, x, ms);
    nudgeX = x;
  };

  const slide = (target: number) => {
    const d = Math.max(0, Math.min(room(), target)) - el.scrollLeft;
    window.clearTimeout(rest);
    acc = 0;
    if (Math.abs(d) < 1) {
      nudge(0, 300);
      return;
    }
    if (still.matches) {
      for (const a of shifting) a.cancel();
      shifting = [];
      nudgeX = 0;
      el.scrollLeft += d;
      return;
    }
    busy = true;
    const from = nudgeX;
    nudgeX = 0;
    const run = shift(from, d, SLIDE_MS);
    run[0]?.finished.then(
      () => {
        if (shifting !== run) return;
        // Landed: the scroll takes over in the same frame the shift goes.
        el.scrollLeft += d;
        for (const a of run) a.cancel();
        shifting = [];
        busy = false;
      },
      () => {
        if (shifting === run) busy = false;
      },
    );
  };

  /** The screen `x` is in and how far through it. */
  const span = (x: number) => {
    const s = stops();
    let i = 0;
    while (i < s.length - 1 && s[i + 1] <= x) i++;
    const from = s[i];
    const to = s[Math.min(i + 1, s.length - 1)];
    return { from, to, gone: to > from ? (x - from) / (to - from) : 0 };
  };

  const turn = (dir: number) => {
    const s = stops();
    const x = el.scrollLeft;
    let i = 0;
    for (let k = 1; k < s.length; k++) if (Math.abs(s[k] - x) < Math.abs(s[i] - x)) i = k;
    slide(s[Math.max(0, Math.min(s.length - 1, i + dir))]);
  };

  /** The fingers are off: on to the screen the push was heading for. */
  const letGo = () => {
    window.clearTimeout(rest);
    if (padGone || busy) return;
    padGone = true;
    const x = el.scrollLeft;
    const dir = Math.sign(padV) || Math.sign(padNet) || 1;
    // Where the momentum would have run out, about 300ms of its speed.
    const { from, to, gone } = span(x + padV * 300);
    const flick = Math.abs(padV) > 0.15;
    const target = dir > 0 ? (flick || gone > 0.2 ? to : from) : flick || gone < 0.8 ? from : to;
    slide(target);
  };

  const pad = (d: number, at: number) => {
    const mag = Math.abs(d);
    const dt = at - padAt;
    padAt = at;
    if (dt > GESTURE_GAP_MS) {
      padV = padPeak = padPrev = padFall = padNet = 0;
      padGone = false;
    } else if (padGone) {
      // The tail of a push that has let go, unless it climbs again: a new push.
      if (!(mag > padPrev * 1.5 && mag > 4) || busy) {
        padPrev = mag;
        return;
      }
      padGone = false;
      padPeak = padFall = padNet = 0;
    }
    if (busy) return;
    el.scrollLeft = Math.max(0, Math.min(room(), el.scrollLeft + d));
    padNet += d;
    padV = padV * 0.6 + (d / Math.min(Math.max(dt, 4), 50)) * 0.4;
    padFall = mag <= padPrev && mag < padPeak ? padFall + 1 : 0;
    padPeak = Math.max(padPeak, mag);
    padPrev = mag;
    // Four falling deltas under half the peak: momentum, so the fingers are off.
    if (padFall >= 4 && mag < padPeak * 0.5) return letGo();
    window.clearTimeout(rest);
    rest = window.setTimeout(letGo, GESTURE_GAP_MS + 20);
  };

  const wheel = (dy: number, isPad: boolean, at: number) => {
    if (isPad) return pad(dy, at);
    if (busy) return;
    if (at - accAt > 250) acc = 0;
    accAt = at;
    acc += Math.sign(dy);
    if (Math.abs(acc) >= TURN) return turn(Math.sign(acc));
    // Not yet a turn: a little of the way, and back once the hand rests.
    nudge(Math.sign(acc) * Math.min(Math.abs(acc) * 30, 48), 160);
    window.clearTimeout(rest);
    rest = window.setTimeout(() => {
      acc = 0;
      nudge(0, 360);
    }, 220);
  };

  flatSlide.set(el, { wheel });
  return () => {
    flatSlide.delete(el);
    window.clearTimeout(rest);
    for (const a of shifting) a.cancel();
    shifting = [];
  };
}
