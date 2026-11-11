/**
 * The DOM event names components coordinate through, in one place.
 * Who sends each and who listens is beside it.
 */

/** On the window, when the strip writes the section into the address
    (`components/strip/use-reader.ts`, `stacked.ts`), which a `replaceState`
    does not announce: the header lights About or Contact from it. */
export const STRIP_SECTION = "strip:section";

/** On the strip's scroller: a seat was set from outside (`strip/arrival.ts`),
    so a resize keeps that place (`strip/use-motion.ts`, `strip/paging.ts`). */
export const STRIP_NOTE = "jg:note";

/** On the strip's scroller: back to the first screen. Heard by
    `strip/use-motion.ts`; its sender was the old site header. */
export const STRIP_HOME = "jg:home";
