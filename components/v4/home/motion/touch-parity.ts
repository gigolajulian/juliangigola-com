/* Phones and tablets get the desktop's motion. On by default.
   `?mttp=0` turns all of it off, `?mttp=-flip,-sink` the listed items, `?mttp=flip,sink` keeps only those. engine.ts sets html[data-tp-<item>] for touch-parity.css. */
import { qvalue } from "@/lib/v4-home/flags";

export const TP = ["sink", "covers", "flip", "films", "drift", "about", "sheet", "press"] as const;
export type TpItem = (typeof TP)[number];

export const tp = (k: TpItem) => {
  if (typeof location === "undefined") return false;
  const m = qvalue("mttp", "[\\w,-]+");
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
