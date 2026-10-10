import * as React from "react";

/** How long a visitor is left alone before the rail says the page runs
    sideways, how long the travel lasts, and where the session remembers
    that it has already been said. */
const CUE_WAIT = 2000;
const CUE_MS = 900;
const CUE_SEEN = "strip-cue";
/** The page itself shows there is more. A paged strip slides this far
    left as the rail travels, the next screen's edge comes in, and it
    springs back. Preview only, `?peek=1`, which also shows it on every
    load so it can be watched again. */
const PEEK = 64;

/** The sideways cue (`cue` in `strip.tsx`): the rail travels once, two
    seconds in, and a paged strip peeks under `?peek=1`. */
export function useCue({
  scroller: scrollerRef,
  live,
  paged,
  setCue,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
  live: boolean;
  paged: boolean;
  setCue: (cue: boolean) => void;
}) {
  React.useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !live) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const peek =
      paged && new URLSearchParams(window.location.search).get("peek") === "1";
    try {
      if (!peek && window.sessionStorage.getItem(CUE_SEEN)) return;
    } catch {
      // Private browsing. Showing it once more than it should is the
      // harmless way to be wrong about a courtesy.
    }
    // Nothing to teach on a page that does not run past its own edge.
    if (el.scrollWidth - el.clientWidth < 40) return;

    let held: ReturnType<typeof setTimeout>;
    let wait: ReturnType<typeof setTimeout>;
    let peeks: Animation[] = [];
    const watched = ["scroll", "wheel", "pointerdown", "touchstart"];
    const quit = () => {
      clearTimeout(wait);
      clearTimeout(held);
      lifted.disconnect();
      peeks.forEach((a) => a.cancel());
      setCue(false);
      for (const t of watched) el.removeEventListener(t, quit);
      window.removeEventListener("keydown", quit);
    };
    const start = () =>
      (wait = setTimeout(() => {
        try {
          window.sessionStorage.setItem(CUE_SEEN, "1");
        } catch {
          // As above.
        }
        setCue(true);
        /* Every screen, added to whatever translate it already has, and
           from script so no screen's own entrance animation is replaced. */
        if (peek)
          peeks = Array.from(el.children).map((c) =>
            c.animate(
              [
                { translate: "0px", easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
                { translate: `${-PEEK}px`, offset: 0.4, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
                { translate: "0px" },
              ],
              { duration: CUE_MS, composite: "add" },
            ),
          );
        held = setTimeout(quit, CUE_MS);
      }, CUE_WAIT));
    /* The two seconds count from the page being seen: on a first visit
       they ran out under the splash, and the cue played to nobody. */
    const root = document.documentElement;
    const lifted = new MutationObserver(() => {
      if ("intro" in root.dataset) return;
      lifted.disconnect();
      start();
    });
    if ("intro" in root.dataset)
      lifted.observe(root, { attributeFilter: ["data-intro"] });
    else start();
    for (const t of watched) el.addEventListener(t, quit, { passive: true });
    window.addEventListener("keydown", quit);
    return quit;
  }, [scrollerRef, live, paged, setCue]);
}
