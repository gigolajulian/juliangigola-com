/* Phones and tablets get the desktop's motion, item by item. engine.ts sets html[data-tp-<item>] for touch-parity.css. */

const TP_ITEMS = ["sink", "covers", "flip", "films", "drift", "about", "sheet", "press"] as const;

export function touchParity() {
  const html = document.documentElement;
  for (const k of TP_ITEMS) html.setAttribute("data-tp-" + k, "");
  // iOS Safari only shows :active on a page with a touchstart listener
  const noop = () => {};
  addEventListener("touchstart", noop, { passive: true });
  return () => {
    for (const k of TP_ITEMS) html.removeAttribute("data-tp-" + k);
    removeEventListener("touchstart", noop);
  };
}
