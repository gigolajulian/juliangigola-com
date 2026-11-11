/**
 * The DOM event names components coordinate through, in one place.
 * Who sends each and who listens is beside it.
 */

/** On the strip's scroller: a seat was set from outside (`strip/arrival.ts`),
    so a resize keeps that place (`strip/use-motion.ts`, `strip/paging.ts`). */
export const STRIP_NOTE = "jg:note";

/** On the strip's scroller: back to the first screen. Heard by
    `strip/use-motion.ts`; its sender was the old site header. */
export const STRIP_HOME = "jg:home";
