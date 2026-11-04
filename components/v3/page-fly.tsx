"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { scrollTop } from "@/components/v3/smooth-scroll";

/* Page opening A (mock https://claude.ai/artifact/6Nbep18kL572cWznUuA66K):
   the photo you click grows into the next page's hero. Any link, or a row
   with `data-fly-to`, that holds a photo (or sits in a door with one) is a
   source; the next page's project frame or stepper photo is the target.
   Links without a photo, or pages without a hero, open plainly. Only with
   ?v3motion, never under reduced motion. */
const HERO = ".v3 .pj-big, .v3 .f-photo .ph";
const EASE = "cubic-bezier(.16,1,.3,1)";
/* MOTION-PLAN.md item 3 on trial (`?mplan=pages`): the photo travels on
   `move` in 600, the covers left behind recede, the project's other frames
   rise in as it lands, and back flies the hero home to its tile. */
const MOVE = "cubic-bezier(.77,0,.175,1)", OUT = "cubic-bezier(.23,1,.32,1)";
const trial = () => !!document.documentElement.dataset.mplan?.split(" ").includes("pages");
const onScreen = (r: DOMRect) => r.width > 0 && r.bottom > 0 && r.top < innerHeight;
/** Sets a root flag for one trip; the transition's CSS reads it as it starts. */
const flag = (k: "mpFly") => {
  const root = document.documentElement;
  root.dataset[k] = "";
  window.setTimeout(() => delete root.dataset[k], 1500);
};

type Fly = { to: string; t: number; r: DOMRect; src: string };
type Back = { t: number; hero?: { slug: string; r: DOMRect; src: string } };

function shown(i: HTMLImageElement) {
  const s = getComputedStyle(i);
  return i.offsetWidth > 0 && s.display !== "none" && s.opacity !== "0";
}

export function PageFly() {
  const path = usePathname();
  const fly = React.useRef<Fly | null>(null);
  const pushed = React.useRef<string | null>(null);
  const back = React.useRef<Back | null>(null);
  const here = React.useRef(path);

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
      if (fly.current && img && trial()) {
        flag("mpFly");
        /* The covers left behind get names before the page is snapshotted,
           so each recedes on its own (`.mp-out`, motion-plan.css). */
        const others = [...document.querySelectorAll<HTMLElement>(".v3 .wgrid .wt .ph, .v3 .sc-res .wt .ph")]
          .filter((e) => !e.contains(img) && onScreen(e.getBoundingClientRect()))
          .slice(0, 12);
        others.forEach((e, i) => {
          e.style.setProperty("view-transition-name", `mp-o${i}`);
          e.style.setProperty("view-transition-class", "mp-out");
        });
        window.setTimeout(() => others.forEach((e) => (e.style.removeProperty("view-transition-name"), e.style.removeProperty("view-transition-class"))), 1500);
      }
    };
    /* Back from a project, read while its page is still up: the browser's
       pop, or the replay page-transition.tsx hands back inside its trip. */
    const pop = () => {
      if (!trial() || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (back.current && Date.now() - back.current.t < 300) return;
      const hero = document.querySelector<HTMLElement>(HERO);
      const img = hero?.querySelector("img");
      const r = hero?.getBoundingClientRect();
      // The page being left, by the path it was rendered for (location has already moved on).
      const slug = here.current.match(/^\/portfolio\/([^/]+)$/)?.[1];
      back.current = { t: Date.now(), hero: hero && img && r && onScreen(r) && slug ? { slug, r, src: img.currentSrc || img.src } : undefined };
    };
    document.addEventListener("click", click, true);
    window.addEventListener("popstate", pop, true);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("popstate", pop, true);
    };
  }, []);

  // Layout phase: the hero is hidden before the page crossfade captures it.
  React.useLayoutEffect(() => {
    /* A link opens the next page at its top, flag or not: the V3 pages sit in
       a `display: contents` wrapper whose empty box Next reads as already in
       view, so it kept the old scroll. Back and forward keep theirs. */
    if (pushed.current === path) scrollTop();
    pushed.current = null;
    here.current = path;
    const t = trial();
    const box = (r: DOMRect) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    // A fixed copy flies from one box to the other; its box animates (not a
    // scale), so the crop never stretches. `to` is hidden until it lands.
    const flyCopy = (from: DOMRect, src: string, to: HTMLElement, duration: number, easing: string) => {
      const h = to.getBoundingClientRect();
      const c = document.createElement("div");
      c.setAttribute("aria-hidden", "");
      Object.assign(c.style, { position: "fixed", zIndex: "60", overflow: "hidden", borderRadius: "4px", pointerEvents: "none", left: `${h.left}px`, top: `${h.top}px`, width: `${h.width}px`, height: `${h.height}px` });
      c.innerHTML = `<img alt="" src="${src}" style="width:100%;height:100%;object-fit:cover;display:block">`;
      document.body.append(c);
      to.style.visibility = "hidden";
      c.animate([box(from), box(h)], { duration, easing }).finished.then(() => {
        to.style.visibility = "";
        c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150 }).finished.then(() => c.remove());
      });
    };
    let n = 0, raf = 0;
    /* Item 3, back. A pop runs no view transition today (it cut), so the
       page returned to comes down 2.5vh and fades in on its own; and the
       hero shrinks home to its tile when that tile is on screen once the
       page has its scroll back. */
    const b = back.current;
    back.current = null;
    if (t && b && Date.now() - b.t < 4000) {
      const main = document.getElementById("main");
      if (main && !(document as Document & { activeViewTransition?: unknown }).activeViewTransition) {
        main.animate({ transform: ["translateY(-2.5vh)", "none"] }, { duration: 400, easing: "cubic-bezier(.32,.72,0,1)" });
        main.animate({ opacity: [0, 1] }, { duration: 400, easing: OUT });
      }
      const go = b.hero;
      if (!go) return;
      const home = () => {
        const tile = document.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(go.slug)}"]`);
        const r = tile?.getBoundingClientRect();
        if (!tile || !r?.width) return void (++n < 30 && (raf = requestAnimationFrame(home)));
        if (onScreen(r)) flyCopy(go.r, go.src, tile, 600, MOVE);
      };
      raf = requestAnimationFrame(home);
      return () => cancelAnimationFrame(raf);
    }
    const f = fly.current;
    if (!f || f.to !== path || Date.now() - f.t > 4000) return;
    fly.current = null;
    const land = () => {
      const hero = document.querySelector<HTMLElement>(HERO);
      const h = hero?.getBoundingClientRect();
      if (!hero || !h?.width) return void (++n < 60 && (raf = requestAnimationFrame(land)));
      if (h.bottom < 0 || h.top > innerHeight) return;
      if (!t) {
        hero.closest("section, .flow")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 100, easing: EASE, fill: "backwards" });
        return flyCopy(f.r, f.src, hero, 550, EASE);
      }
      flyCopy(f.r, f.src, hero, 600, MOVE);
      // The project's other frames on screen rise in as the hero lands (pick 2c).
      [...document.querySelectorAll<HTMLElement>(".v3 .pj-r")]
        .filter((e) => !e.contains(hero) && !hero.contains(e) && onScreen(e.getBoundingClientRect()))
        .slice(0, 6)
        .forEach((e, i) => e.animate({ opacity: [0, 1], transform: ["translateY(16px)", "none"] }, { duration: 600, delay: 300 + i * 40, easing: OUT, fill: "backwards" }));
    };
    land();
    return () => cancelAnimationFrame(raf);
  }, [path]);

  return null;
}
