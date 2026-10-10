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

/** Sent on the window when the strip writes the section into the address
    (`strip.tsx`), which a `replaceState` does not announce: the header
    lights About or Contact from it on the homepage. */
export const STRIP_SECTION = "strip:section";

/* The addresses that are the work index with its row swapped (All,
   each discipline, Motion) rather than pages of their own. A
   discipline and a project are both /portfolio/<slug>, so the address
   cannot tell them apart; the filter drawer, mounted on every
   /portfolio page, marks its links that are filters
   (`work-filter.tsx`). */
export const filterPaths = (): Set<string> =>
  new Set(
    Array.from(
      document.querySelectorAll<HTMLAnchorElement>("#work-filter a[data-filter]"),
      (a) => a.pathname,
    ),
  );
