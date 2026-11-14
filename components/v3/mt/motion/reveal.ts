/* Phone and tablet (no holds): each block comes into frame as it scrolls into view, once.
   The desktop holds have their own beats, so reveal.css only applies when nothing is held. */
const BLOCKS = [
  ".mt-comm-head", ".mt-masonry figure", ".mt-logos",
  ".mt-held .mt-stage > *",
  ".mt-book .mt-book-col > *", ".mt-book .mt-photo",
  ".mt-quote .mt-frame > *",
  ".mt-about .mt-ab-ph", ".mt-about .mt-wordmark",
].join(",");

export function startReveal(root: HTMLElement) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  const els = [...root.querySelectorAll<HTMLElement>(BLOCKS)];
  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.rv = "in";
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  for (const el of els) {
    el.dataset.rv = "";
    io.observe(el);
  }
  return () => {
    io.disconnect();
    for (const el of els) delete el.dataset.rv;
  };
}
