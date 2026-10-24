"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/* Page opening A (mock https://claude.ai/artifact/6Nbep18kL572cWznUuA66K):
   the photo you click grows into the next page's hero. Any link, or a row
   with `data-fly-to`, that holds a photo (or sits in a door with one) is a
   source; the next page's project frame or stepper photo is the target.
   Links without a photo, or pages without a hero, open plainly. Only with
   ?v3motion, never under reduced motion. */
const HERO = ".v3 .pj-big, .v3 .f-photo .ph";
const EASE = "cubic-bezier(.16,1,.3,1)";

type Fly = { to: string; t: number; r: DOMRect; src: string };

function shown(i: HTMLImageElement) {
  const s = getComputedStyle(i);
  return i.offsetWidth > 0 && s.display !== "none" && s.opacity !== "0";
}

export function PageFly() {
  const path = usePathname();
  const fly = React.useRef<Fly | null>(null);
  const pushed = React.useRef<string | null>(null);

  React.useEffect(() => {
    const click = (e: MouseEvent) => {
      const el = (e.target as Element).closest<HTMLElement>(".v3 a[href], .v3 [data-fly-to]");
      if (!el || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
      const to = el.dataset.flyTo ?? (el instanceof HTMLAnchorElement && el.origin === location.origin && !el.hash ? el.pathname : null);
      pushed.current = to;
      if (!document.documentElement.hasAttribute("data-v3motion") || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const scope = el.dataset.flySrc ? document.querySelector(el.dataset.flySrc) : el.querySelector("img") ? el : el.closest(".door");
      const img = scope && [...scope.querySelectorAll("img")].find(shown);
      fly.current = to && img ? { to, t: Date.now(), r: img.getBoundingClientRect(), src: img.currentSrc || img.src } : null;
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);

  // Layout phase: the hero is hidden before the page crossfade captures it.
  React.useLayoutEffect(() => {
    /* A link opens the next page at its top, flag or not: the V3 pages sit in
       a `display: contents` wrapper whose empty box Next reads as already in
       view, so it kept the old scroll. Back and forward keep theirs. */
    if (pushed.current === path) scrollTo(0, 0);
    pushed.current = null;
    const f = fly.current;
    if (!f || f.to !== path || Date.now() - f.t > 4000) return;
    fly.current = null;
    let n = 0, raf = 0;
    const land = () => {
      const hero = document.querySelector<HTMLElement>(HERO);
      const h = hero?.getBoundingClientRect();
      if (!hero || !h?.width) return void (++n < 60 && (raf = requestAnimationFrame(land)));
      if (h.bottom < 0 || h.top > innerHeight) return;
      // A fixed copy flies from the clicked photo's box to the hero's; its
      // box animates (not a scale), so the crop never stretches.
      const c = document.createElement("div");
      c.setAttribute("aria-hidden", "");
      Object.assign(c.style, { position: "fixed", zIndex: "60", overflow: "hidden", borderRadius: "4px", pointerEvents: "none", left: `${h.left}px`, top: `${h.top}px`, width: `${h.width}px`, height: `${h.height}px` });
      c.innerHTML = `<img alt="" src="${f.src}" style="width:100%;height:100%;object-fit:cover;display:block">`;
      document.body.append(c);
      hero.style.visibility = "hidden";
      hero.closest("section, .flow")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 100, easing: EASE, fill: "backwards" });
      const box = (r: DOMRect) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      c.animate([box(f.r), box(h)], { duration: 550, easing: EASE }).finished.then(() => {
        hero.style.visibility = "";
        c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).finished.then(() => c.remove());
      });
    };
    land();
    return () => cancelAnimationFrame(raf);
  }, [path]);

  return null;
}
