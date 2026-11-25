import { matches } from "@/lib/device";

/* Phone and tablet (no holds): each block comes into frame as it scrolls into view, once.
   The desktop holds have their own beats, so reveal.css only applies when nothing is held. */
const BLOCKS = [
  ".mt-comm-head",
  ".mt-masonry figure",
  ".mt-logos",
  ".mt-held .mt-stage > *",
  ".mt-book .mt-book-col > *",
  ".mt-book .mt-photo",
  ".mt-quote .mt-frame > *",
  ".mt-about .mt-ab-ph",
  ".mt-about .mt-wordmark",
].join(",");

/* In for good once it comes into frame. Visible by default: a block is hidden only once the observer has seen it
   below the fold, so an observer that never calls back leaves the text showing (audit). */
export function arrived(es: IntersectionObserverEntry[], io: IntersectionObserver) {
  for (const e of es) {
    const el = e.target as HTMLElement;
    // the strip under the -8% margin is on screen already: in, not hidden and then shown
    const shown = e.isIntersecting || e.boundingClientRect.top < innerHeight;
    if (shown || el.dataset.rv === "in") {
      el.dataset.rv = "in";
      io.unobserve(el);
    } else el.dataset.rv ??= "";
  }
}

export function startReveal(root: HTMLElement) {
  if (matches("calm")) return () => {};
  const els = [...root.querySelectorAll<HTMLElement>(BLOCKS)];
  const io = new IntersectionObserver(arrived, { rootMargin: "0px 0px -8% 0px" });
  for (const el of els) io.observe(el);
  return () => {
    io.disconnect();
    for (const el of els) delete el.dataset.rv;
  };
}
