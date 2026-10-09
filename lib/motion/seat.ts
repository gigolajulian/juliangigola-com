/* ── which screen a lift lands on ─────────────────────────────────
 * The choice a paged strip makes when a finger lifts (`nearest` in
 * `components/strip/motion.ts`, `onTouchEnd` in
 * `components/strip/touch.ts`).
 * ─────────────────────────────────────────────────────────────── */

/**
 * The cell whose centre is nearest `middle`, a position along the strip
 * (the scroll position plus half the window). `centres` are the cells'
 * centres in the same terms. On a tie the earlier cell wins, and an empty
 * strip answers 0.
 */
export function nearestSeat(centres: readonly number[], middle: number) {
  let best = 0;
  let near = Infinity;
  centres.forEach((c, i) => {
    const off = Math.abs(c - middle);
    if (off < near) {
      near = off;
      best = i;
    }
  });
  return best;
}

/**
 * The screen to go to: `landed`, the one nearest where the throw would
 * land, but at most one away from `downSeat`, the screen under the strip
 * when the finger went down, and always one of the `count` there are.
 */
export function chooseSeat(landed: number, downSeat: number, count: number) {
  const seat = Math.max(downSeat - 1, Math.min(downSeat + 1, landed));
  return Math.max(0, Math.min(count - 1, seat));
}
