/* ── a trackpad or a wheel ────────────────────────────────────────
 * How the canvas tells a trackpad's event from a mouse wheel's notch
 * (`onWheel` in `components/portfolio/canvas.tsx`).
 * ─────────────────────────────────────────────────────────────── */

/** The device-pixel size at or above which an event is a notch. */
export const NOTCH_PX = 80;

export type WheelDelta = { deltaMode: number; deltaX: number; deltaY: number };

/** A trackpad's event: in pixels (`deltaMode` 0) and under `NOTCH_PX`
    device pixels on its larger axis. */
export function isTrackpad(e: WheelDelta, dpr: number) {
  return e.deltaMode === 0 && Math.max(Math.abs(e.deltaX), Math.abs(e.deltaY)) * (dpr || 1) < NOTCH_PX;
}

/** Reads a wheel stream (events under `gapMs` apart) by its first event: a stream that opens on a notch is a mouse
    wheel to its end, one that opens under a notch is a trackpad to its end, even when a fast flick later passes
    `NOTCH_PX` (it does on 2x screens). Call it on every wheel event, so it sees where each stream starts. */
export function notchStream(gapMs = 120) {
  let at = -Infinity,
    notch = false;
  return (e: WheelDelta & { timeStamp: number }, dpr: number) => {
    if (e.timeStamp - at > gapMs) notch = !isTrackpad(e, dpr);
    at = e.timeStamp;
    return notch;
  };
}
