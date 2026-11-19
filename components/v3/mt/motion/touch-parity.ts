/* Phones and tablets get the desktop's motion, one item at a time, each off until Julian picks it (2026-11-18, "integrate").
   `?mttp=sink,flip` turns on the listed items, `?mttp=all` every one. engine.ts sets html[data-tp-<item>] for touch-parity.css. */
export const TP = ["sink", "covers", "flip", "films", "drift", "about", "sheet", "press"] as const;
export type TpItem = (typeof TP)[number];

export const tp = (k: TpItem) => {
  if (typeof location === "undefined") return false;
  const m = /[?&]mttp=([\w,]+)/.exec(location.search)?.[1] ?? "";
  return m === "all" || m.split(",").includes(k);
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
