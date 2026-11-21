import type { gsap as G } from "gsap";

/* The booking card's gsap only runs after a tap (a step, a pick, a swipe)
   or the swipe nudge once the splash lifts, so it is fetched on idle after
   hydration instead of in the first-load bundle. By the first tap it is
   there and the motion starts on the same frame; before that, it waits. */
let gsap: typeof G | undefined;
let loading: Promise<typeof G> | undefined;
const load = () => (loading ??= import("gsap").then((m) => (gsap = m.gsap)));

export function warmGsap() {
  if (gsap) return;
  if ("requestIdleCallback" in window) requestIdleCallback(() => void load());
  else setTimeout(load, 1);
}

export function withGsap(fn: (g: typeof G) => void) {
  if (gsap) fn(gsap);
  else void load().then(fn);
}
