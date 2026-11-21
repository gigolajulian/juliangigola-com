"use client";

import * as React from "react";
import { jumpTo, scrollGoal } from "@/components/v3/smooth-scroll";
import { holdLanding } from "@/components/site/page-transition";
import { media } from "@/lib/device";
import { painted } from "@/lib/painted";
import { tell } from "./motion/engine";

/* Back to the home from any page of the site lands where the visitor left it, from the first paint.
   Safari put back a scroll saved before the held rows' last scroll (MAC on #1313), and from /about showed that page's foot
   for 100ms before the home's top (MAC, live). So the home keeps its own spot: the block the screen's top was in
   (`[data-mt]`) and how far into it, since the held blocks above take their height a frame or more after the page is back;
   and the covers row's own scroll on a phone, which is sideways. Session storage: the router rewrites the history entry's state. */

const BACK = "jg-home-back";
export type Spot = { b: string; off: number; x: number };

/** An element's top in the page by layout: its box on screen moves with the blocks' lift transforms. */
export const layoutTop = (el: HTMLElement) => {
  let t = 0;
  for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) t += n.offsetTop;
  return t;
};

const block = (b: string) => document.querySelector<HTMLElement>(`[data-mt="${b}"]`);
const coversRow = () => block("covers")?.querySelector<HTMLElement>(".mt-row") ?? null;

/** The spot under the screen's top: the last block that starts at or above it. */
export function spotHere(): Spot {
  // the covers row's own scroll wherever the page is: a phone's row swiped to a cover came back on the first (MAC on d818269b)
  const x = coversRow()?.scrollLeft ?? 0;
  let at: Spot = { b: "", off: scrollY, x };
  for (const el of document.querySelectorAll<HTMLElement>("[data-mt]")) {
    const t = layoutTop(el);
    if (t <= scrollY + 1) at = { b: el.dataset.mt!, off: scrollY - t, x };
  }
  return at;
}

/** Keeps `spot` for the next Back to the home, and keeps the browser's own restore from landing over it a frame later (Safari, MAC on 01ca50cb). */
export function keepSpot(spot: Spot) {
  try {
    sessionStorage.setItem(BACK, JSON.stringify(spot));
    history.scrollRestoration = "manual";
  } catch {}
}

/** A click that kept a spot but stayed on the page (a tap that turns a sleeve over) gives the browser its own restore back. */
export function dropSpot() {
  try {
    sessionStorage.removeItem(BACK);
    history.scrollRestoration = "auto";
  } catch {}
}

/** Where a spot is in the page now. */
const yOf = (s: Spot) => {
  const el = s.b ? block(s.b) : null;
  return (el ? layoutTop(el) : 0) + s.off;
};

/** A link off the home: another page of this site, opened in this tab. */
function leaves(e: MouseEvent) {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return false;
  const u = new URL(a.href, location.href);
  return u.origin === location.origin && u.pathname !== location.pathname;
}

/** When the last Back or Forward was: the home counts as a return only when it mounts just after one. */
let popAt = 0;
if (typeof window !== "undefined") addEventListener("popstate", () => (popAt = Date.now()));
let firstMount = true;
/** Just back: a Back or Forward inside the site, or the page itself loaded by one (a link that left the app, then Back). */
const returned = () => {
  const first = firstMount;
  firstMount = false;
  if (Date.now() - popAt < 2000) return true;
  const nav = first ? (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined) : undefined;
  return nav?.type === "back_forward";
};

/** On the home: keeps the spot at every link off it (a cover keeps its own over it, rows.tsx), and puts the kept spot back
    after a Back, before the first paint, then holds it each frame for a moment while the blocks above settle, until the visitor scrolls. */
export function useBackHome() {
  React.useLayoutEffect(() => {
    // capture: before React's own click handlers, so a cover's spot (rows.tsx keepFlip) is the one kept
    const save = (e: MouseEvent) => leaves(e) && keepSpot(spotHere());
    document.addEventListener("click", save, true);
    let at: Spot | null = null;
    try {
      at = JSON.parse(sessionStorage.getItem(BACK) ?? "null");
    } catch {}
    // taken a tick on, not now: React's dev double mount read it once and dropped it
    const t = setTimeout(() => {
      try {
        sessionStorage.removeItem(BACK);
        history.scrollRestoration = "auto";
      } catch {}
    });
    const off = () => (clearTimeout(t), document.removeEventListener("click", save, true));
    if (!at || typeof at.off !== "number" || !returned()) return off;
    const spot = at;
    const go = () => {
      const y = yOf(spot);
      if (Math.abs(scrollY - y) > 2 || Math.abs(scrollGoal() - y) > 2) jumpTo(y);
    };
    go();
    // a phone's sideways covers row only: held (desktop), the row follows the page's scroll, and setting it too threw the page a screen on (MAC on d82f2b75)
    const row = coversRow();
    if (row && !media("held").matches) row.scrollLeft = spot.x;
    // Back into Cover art: the sleeves' lazy art painted grey for up to 1.3s on an iPhone (MAC, v3.0.336). Load and decode it now, with the rest.
    const items = row && spot.b === "covers" ? [...row.querySelectorAll<HTMLElement>(".mt-item")] : [];
    const step = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : 0, i = step ? Math.min(items.length - 1, Math.max(0, Math.round(spot.x / step))) : 0;
    // the caption names that cover from the first paint, not the first one for a frame or two until the row's scroll event (Julian)
    // the told sleeve takes its focus scale at once, not over the .45s scale transition (touch-parity.css): reset with the lifted ones below
    if (items.length && !media("held").matches) items.forEach((it) => (it.style.transition = "none")), tell(row!.closest("section")!, { cur: i }, false);
    for (const it of items.slice(Math.max(0, i - 1), i + 2)) {
      const im = it.querySelector<HTMLImageElement>(".face img:not(.back)");
      if (!im) continue;
      im.loading = "eager";
      im.fetchPriority = "high";
      // the copy the viewer just showed goes under it, so the sleeve is never grey while its own size loads (Julian: "shouldnt cut out like that")
      const url = painted.get(im.dataset.frame ?? ""), face = im.parentElement!;
      // the image only: the shorthand also cleared the card colour, so the disc showed through until it decoded
      if (url) Object.assign(face.style, { backgroundImage: `url("${url}")`, backgroundSize: "cover", backgroundPosition: "center" });
      const shown = im.decode().catch(() => {});
      if (it === items[i]) holdLanding(shown); // the Back's snapshot of the home waits for this cover (page-transition.tsx)
      shown.then(() => url && Object.assign(face.style, { backgroundImage: "", backgroundSize: "", backgroundPosition: "" }));
    }
    // a sleeve still marked hovered from before the click turned to its back and then away on arrival (Safari, MAC on 23412f74): unturned at once
    const lifted = [...new Set([...items, ...document.querySelectorAll<HTMLElement>(".mt-covers .mt-sleeve.hv")])];
    lifted.forEach((it) => ((it.style.transition = "none"), it.classList.remove("hv")));
    const unlift = requestAnimationFrame(() => requestAnimationFrame(() => lifted.forEach((it) => (it.style.transition = ""))));
    // rAF runs before each paint, so a block above that grows is answered in the same frame
    const end = performance.now() + 900;
    let raf = 0, done = false, goal = scrollGoal(); // after go(): Lenis's target is the restore spot
    const stop = () => ((done = true), cancelAnimationFrame(raf));
    raf = requestAnimationFrame(function hold(now) {
      // the visitor's scroll wins: Lenis heads somewhere else as soon as a wheel or touch lands, whether or not its event reached us
      // (a wheel 0.3s after Back was held for 0.6s, Safari, MAC on 23412f74). Only a move of its target counts: it starts stale from the last page.
      const g = scrollGoal(), moved = g !== goal && Math.abs(g - yOf(spot)) > 2;
      goal = g;
      if (done || moved) return stop();
      go();
      // a sleeve the row carried under a resting pointer lifts and turns to its back: none while the page is being put back (Safari, MAC on 983abf06)
      for (const it of document.querySelectorAll(".mt-covers .mt-sleeve.hv")) it.classList.remove("hv");
      if (now < end) raf = requestAnimationFrame(hold);
    });
    const ev = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    ev.forEach((n) => addEventListener(n, stop, { passive: true, capture: true }));
    return () => (off(), cancelAnimationFrame(unlift), stop(), ev.forEach((n) => removeEventListener(n, stop, { capture: true })));
  }, []);
}
