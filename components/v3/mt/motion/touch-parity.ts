/* Phones and tablets get the desktop's motion (Julian, 2026-11-18: "integrate", then "push" after MAC passed all eight). On by default.
   `?mttp=0` turns all of it off, `?mttp=-flip,-sink` the listed items, `?mttp=flip,sink` keeps only those. engine.ts sets html[data-tp-<item>] for touch-parity.css. */
export const TP = ["sink", "covers", "flip", "films", "drift", "about", "sheet", "press"] as const;
export type TpItem = (typeof TP)[number];

export const tp = (k: TpItem) => {
  if (typeof location === "undefined") return false;
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) return false; // a mouse gets the desktop motion; iPad landscape (held, coarse) keeps flip and press
  const m = /[?&]mttp=([\w,-]+)/.exec(location.search)?.[1];
  if (!m || m === "all") return true;
  if (m === "0") return false;
  const ks = m.split(",");
  return ks.some((x) => x.startsWith("-")) ? !ks.includes("-" + k) : ks.includes(k);
};

export function touchParity() {
  const html = document.documentElement, on = TP.filter(tp);
  for (const k of on) html.setAttribute("data-tp-" + k, "");
  // iOS Safari only shows :active on a page with a touchstart listener
  const noop = () => {};
  if (on.includes("press")) addEventListener("touchstart", noop, { passive: true });
  return () => {
    for (const k of on) html.removeAttribute("data-tp-" + k);
    removeEventListener("touchstart", noop);
  };
}
