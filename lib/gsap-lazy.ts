import type { gsap as G } from "gsap";

/* The booking card's gsap only runs after a tap (a step, a pick, a swipe)
   or the swipe nudge 1.1 s after the picker shows, so it is fetched once
   the page has hydrated (home's Book online, the picker) instead of in the
   first-load bundle. Not on idle: on a slow phone idle came about 2 s after
   /book's splash lifted, and the nudge with it. By the first tap it is
   there and the motion starts on the same frame; before that, it waits. */
let gsap: typeof G | undefined;
let loading: Promise<typeof G> | undefined;
const load = () => (loading ??= import("gsap").then((m) => (gsap = m.gsap)));

export function warmGsap() {
  void load();
}

export function withGsap(fn: (g: typeof G) => void) {
  if (gsap) fn(gsap);
  else void load().then(fn);
}
