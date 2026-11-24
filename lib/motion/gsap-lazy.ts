import type { gsap as G } from "gsap";
import type { Flip as F } from "gsap/Flip";

/* The shared lazy gsap loader: every caller gets the one gsap module,
   fetched on first ask instead of in the first-load bundle. The booking
   card asks once the page has hydrated (home's Book online, the picker),
   not on idle: on a slow phone idle came about 2 s after /book's splash
   lifted, and the swipe nudge with it. By the first tap it is there and
   the motion starts on the same frame; before that, it waits. */
let gsap: typeof G | undefined;
let loading: Promise<typeof G> | undefined;
/** gsap, fetched once and shared by every caller. */
export const loadGsap = () => (loading ??= import("gsap").then((m) => (gsap = m.gsap)));

export function warmGsap() {
  void loadGsap();
}

export function withGsap(fn: (g: typeof G) => void) {
  if (gsap) fn(gsap);
  else void loadGsap().then(fn);
}

/** gsap if it has loaded, else undefined: for code that only moves once it is there. */
export const gsapNow = () => gsap;

let flip: typeof F | undefined;
let flipping: Promise<typeof F> | undefined;
/** Flip if it has loaded and registered, else undefined. */
export const flipNow = () => flip;
/** gsap's Flip plugin, fetched with gsap and registered once. A failed fetch is asked again next time. */
export const loadFlip = () =>
  (flipping ??= Promise.all([loadGsap(), import("gsap/Flip")]).then(
    ([g, m]) => {
      g.registerPlugin(m.Flip);
      return (flip = m.Flip);
    },
    (e: unknown) => {
      flipping = undefined;
      throw e;
    },
  ));
