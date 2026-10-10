/* ── a trackpad or a wheel ────────────────────────────────────────
 * How the strip tells a trackpad's event from a mouse wheel's notch
 * (`onWheel` in `components/strip/wheel.ts`).
 * ─────────────────────────────────────────────────────────────── */

/** The device-pixel size at or above which an event is a notch. */
export const NOTCH_PX = 80;

export type WheelDelta = { deltaMode: number; deltaX: number; deltaY: number };

/** A trackpad's event: in pixels (`deltaMode` 0) and under `NOTCH_PX`
    device pixels on its larger axis. */
export function isTrackpad(e: WheelDelta, dpr: number) {
  return (
    e.deltaMode === 0 &&
    Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY)) * (dpr || 1) < NOTCH_PX
  );
}
