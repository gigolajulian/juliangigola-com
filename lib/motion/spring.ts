/* ── the lift's spring ────────────────────────────────────────────
 * The spring that carries a paged strip to its screen after a finger
 * lifts (`spring` and `onTouchEnd` in `components/strip.tsx`). Position
 * in px, speed in px per second, a mass of one. Copied here to be
 * tested; the strip does not import it yet.
 * ─────────────────────────────────────────────────────────────── */

/** The spring's response, seconds: the period it would ring at undamped. */
export const RESPONSE = 0.42;
/** The spring's angular frequency, per second. */
export const OMEGA = (2 * Math.PI) / RESPONSE;
/** The size of each step, seconds, so a long frame does not throw it. */
export const SUBSTEP = 0.004;
/** The longest frame the spring will step, seconds. */
export const MAX_FRAME = 0.064;

export type SpringState = { x: number; v: number };

/** The time a frame steps, seconds: from the last frame at `prevAt` to
    `now` (both ms), capped at `MAX_FRAME`, or a 60Hz frame for the first. */
export function frameDt(now: number, prevAt: number) {
  return prevAt ? Math.min(MAX_FRAME, (now - prevAt) / 1000) : 1 / 60;
}

/**
 * One frame of the spring towards `target`, `dt` seconds long, in
 * `SUBSTEP` pieces (semi-implicit Euler: the speed first, then the
 * position from the new speed).
 */
export function stepSpring(s: SpringState, target: number, zeta: number, dt: number): SpringState {
  const k = OMEGA ** 2;
  const c = 2 * zeta * Math.sqrt(k);
  let { x, v } = s;
  for (let left = dt; left > 0; left -= SUBSTEP) {
    const h = Math.min(SUBSTEP, left);
    v += (-k * (x - target) - c * v) * h;
    x += v * h;
  }
  return { x, v };
}

/** Close enough to stop: under half a pixel off and 20px per second. */
export function springSettled(s: SpringState, target: number) {
  return Math.abs(s.x - target) < 0.5 && Math.abs(s.v) < 20;
}

/**
 * The speed the spring sets off at, px per second, from the strip's
 * speed `sv` (px per ms) with `d` px left to `target`. Never more than a
 * critically damped spring can stop in that distance (`OMEGA * |d|`),
 * a quarter more on a flick (`zeta < 1`), and only capped when the strip
 * is already heading towards the target.
 */
export function launchSpeed(sv: number, d: number, zeta: number) {
  const cap = OMEGA * Math.abs(d) * (zeta < 1 ? 1.25 : 1);
  return Math.sign(sv) === Math.sign(d)
    ? Math.sign(sv) * Math.min(Math.abs(sv * 1000), cap)
    : sv * 1000;
}
