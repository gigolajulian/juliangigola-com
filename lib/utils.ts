export { cn } from "cn";

/**
 * Resistance past an edge. The further past, the less each pixel of pull
 * moves the thing being pulled, so it never gets far and never stops dead:
 * things in the real world slow down before they stop. `over` is the raw
 * pull, `dim` the size of the thing, `c` how firm the resistance is. Used by
 * the lightbox's swipe past the ends of a sequence and by the filmstrip
 * past its last frame.
 */
export const rubberband = (over: number, dim: number, c = 0.55) =>
  (over * dim * c) / (dim + c * Math.abs(over));



/** The default sort order for strings (UTF-16 code units), spelled out. Not `localeCompare`: that reorders case and accents. */
export const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** A `useSyncExternalStore` subscribe for a value that never changes after hydration: the server snapshot first, the client one after. */
export const noSubscribe = () => () => {};
