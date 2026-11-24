/* Phones and tablets get the desktop's motion, item by item. The engine calls this at start: html[data-tp] for touch-parity.css. */

export function touchParity() {
  const html = document.documentElement;
  html.setAttribute("data-tp", "");
  // iOS Safari only shows :active on a page with a touchstart listener
  const noop = () => {};
  addEventListener("touchstart", noop, { passive: true });
  return () => {
    html.removeAttribute("data-tp");
    removeEventListener("touchstart", noop);
  };
}
