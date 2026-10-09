/* ── where a throw lands ──────────────────────────────────────────
 * The projection a paged strip makes when a finger lifts
 * (`onTouchEnd` in `components/strip.tsx`): iOS's own scroll
 * deceleration, run out to the end. Copied here to be tested; the strip
 * does not import it yet.
 * ─────────────────────────────────────────────────────────────── */

/** iOS's normal scroll deceleration, per ms. */
export const DECEL = 0.998;
/** Finger speed, px per ms, above which a lift is a flick. */
export const FLICK = 0.25;

/**
 * Where a scroll at `x` moving at `v` px per ms comes to rest. Each ms
 * keeps `DECEL` of the speed, so the distance is the sum of that series:
 * `v * DECEL / (1 - DECEL)`, 499ms worth of the speed at 0.998.
 */
export function projectThrow(x: number, v: number) {
  return x + v * (DECEL / (1 - DECEL));
}

/** The spring's damping for a lift at finger speed `fv`, px per ms:
    critically damped, and a little give on a flick. */
export function dampingFor(fv: number) {
  return Math.abs(fv) > FLICK ? 0.8 : 1;
}
