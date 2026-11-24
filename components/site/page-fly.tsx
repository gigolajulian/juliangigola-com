"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { scrollTop } from "@/components/site/smooth-scroll";
import { v4pages } from "@/lib/flags/v4pages";

/* Page opening A (mock https://claude.ai/artifact/6Nbep18kL572cWznUuA66K):
   the photo you click grows into the next page's hero. Any link, or a row
   with `data-fly-to`, that holds a photo (or sits in a door with one) is a
   source; the next page's project frame or stepper photo is the target.
   Links without a photo, or pages without a hero, open plainly. Only while
   V3 motion is on (the default, `?v3motion=0` turns it off), never under reduced motion. */
const HERO = ".v3 .pj-big, .v3 .f-photo .ph";
/* Motion plan item 3 (docs/decisions.md): the photo travels on
   `move` in 600, the covers left behind recede, the project's other frames
   rise in as it lands, and back flies the hero home to its tile. */
const MOVE = "cubic-bezier(.77,0,.175,1)", OUT = "cubic-bezier(.23,1,.32,1)";
const onScreen = (r: DOMRect) => r.width > 0 && r.bottom > 0 && r.top < innerHeight;
/** Sets a root flag for one trip; the transition's CSS reads it as it starts. */
const flag = (k: "mpFly") => {
  const root = document.documentElement;
  root.dataset[k] = "";
  window.setTimeout(() => delete root.dataset[k], 1500);
};

/** How a /portfolio grid photo sits in its frame (the p3 drift): carried by the flying copy so the crop never steps. */
type Zoom = { scale: string; translate: string; transform: string };
const FLAT: Zoom = { scale: "1", translate: "0px 0px", transform: "none" };
const zoomOf = (img: Element | null | undefined): Zoom | undefined => {
  const s = img && getComputedStyle(img);
  return s && s.scale !== "none" ? { scale: s.scale, translate: s.translate === "none" ? FLAT.translate : s.translate, transform: s.transform } : undefined;
};

/* The page opening since 2026-11-18 (Julian, on the live recording: "default"; it was the `?fly=b` trial, and the `?fly` switch is gone).
   The browser carries the photo. The copied-photo path below stays for what this cannot do: a browser without view
   transitions, and a booking row, which swaps its photo as it is pressed.
   The copy below is a fresh <img>, which decodes off the frame it is added in: the photo was missing for the
   frames that took (about 80ms on production). Decoding it first (`decoding = "sync"`) held the trip 150ms.
   The pressed frame and the next page's hero share one view-transition-name, so the photo is its own
   layer from the trip's first frame: it never fades out with the page it left, and the compositor moves
   it, not layout. It travels on `drawer`, which sets off at once, with a shadow under it while it is in the
   air (motion-plan.css).
   A photo only becomes the hero when it is the hero. Pressed on another frame of the
   project, it recedes last, where it was, and the project rises in whole (`data-fly="away"`). Flying it
   to its own frame down the page was tried: a wide set holds that frame at another shape, and the crop
   stepped as it landed. */
const NAME = "mp-fly";
const carried = () => "startViewTransition" in document;
/* What a carried trip set, taken back when the trip ends, or 4s after a press that never lands (as long as a fly is good for). */
let undo: (() => void)[] = [];
const settle = () => {
  undo.forEach((u) => u());
  undo = [];
};
/** Names a frame for the trip; the returned call takes the name alone back off. */
const named = (e: HTMLElement) => {
  // `data-flying`: the frame carries the photo alone, no caption, and no card ground over a hero still loading (motion-plan.css).
  e.dataset.flying = "";
  e.style.setProperty("view-transition-name", NAME);
  const unname = () => e.style.removeProperty("view-transition-name");
  undo.push(() => (delete e.dataset.flying, unname()));
  return unname;
};
let unnameSource = () => {};
/** Which photograph a file is, whatever size or loader served it: "iris/03". */
const photo = (i: HTMLImageElement | null | undefined) => (i ? decodeURIComponent(i.currentSrc || i.src).match(/\/work\/([^/?]+\/\d+)/)?.[1] : undefined);

/** On trial: a frame's picture slides up from its own foot, behind the frame's edge, at full strength (Julian: no fade, slide from the bottom). */
const slideUp = (e: HTMLElement, i: number) => {
  const pic = e.querySelector("img");
  if (!pic) return;
  e.style.overflow = "clip";
  pic.style.transform = "translateY(101%)";
  const t0 = performance.now();
  // Held below the frame until the picture is there to slide (1.5s at most): a file that landed mid-slide popped in.
  Promise.race([pic.decode().catch(() => {}), new Promise((r) => window.setTimeout(r, 1500))]).then(() => {
    pic.style.removeProperty("transform");
    const delay = Math.max(0, 140 + i * 70 - (performance.now() - t0));
    pic.animate({ transform: ["translateY(101%)", "none"] }, { duration: 700, delay, easing: "cubic-bezier(.32,.72,0,1)", fill: "backwards" }).finished.finally(() => e.style.removeProperty("overflow"));
  });
};

type Fly = { to: string; t: number; r: DOMRect; src: string; z?: Zoom; vt?: boolean; photo?: string };
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
      // An oversized grid photo flies from its frame, not from its own larger box.
      const z = zoomOf(img);
      fly.current = to && img ? { to, t: Date.now(), r: ((z && img.closest(".ph")) || img).getBoundingClientRect(), src: img.currentSrc || img.src, z } : null;
      if (fly.current && img) {
        flag("mpFly");
        const mode = carried();
        // Project pages only: a booking row swaps its photo as it is pressed, and keeps the copy.
        if (mode && to!.startsWith("/portfolio/")) {
          settle();
          const mine = undo;
          fly.current.vt = true;
          fly.current.photo = photo(img);
          document.documentElement.dataset.fly = "b";
          // How the grid held the photo in its frame (the p3 drift): the hero sets off held the same way and eases flat, so nothing steps as it lifts.
          const rs = document.documentElement.style;
          rs.setProperty("--fly-z", z?.scale ?? "1");
          rs.setProperty("--fly-t", z?.translate ?? "0px 0px");
          undo.push(() => (delete document.documentElement.dataset.fly, rs.removeProperty("--fly-z"), rs.removeProperty("--fly-t")));
          unnameSource = named(img.closest<HTMLElement>(".ph") ?? img);
          // The press (below) is now the trip's: it runs on until the page it opens is in place.
          const held = press;
          press = null;
          undo.push(() => held?.cancel());
          window.setTimeout(() => undo === mine && settle(), 4000);
        }
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
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // Closing the frame viewer pops its own entry on the same page: that is not a trip back (`?v4pages=view`, project pages).
      if (v4pages("view") && location.pathname === here.current) return;
      if (back.current && Date.now() - back.current.t < 300) return;
      const hero = document.querySelector<HTMLElement>(HERO);
      const img = hero?.querySelector("img");
      const r = hero?.getBoundingClientRect();
      // The page being left, by the path it was rendered for (location has already moved on).
      const slug = here.current.match(/^\/portfolio\/([^/]+)$/)?.[1];
      back.current = { t: Date.now(), hero: hero && img && r && onScreen(r) && slug ? { slug, r, src: img.currentSrc || img.src } : undefined };
    };
    /* On trial: building the next page holds the screen for 150 to 250ms after the click, and nothing started in
       the click can show until then. So the photo answers the press itself: it dips, then lifts, on the
       compositor, and is still rising when the trip takes it over.
       A finger too. A scroll starts like a press, so under a finger the photo waits 90ms for the
       browser to claim the gesture (pointercancel); a tap shorter than that starts as the finger lifts. */
    let press: Animation | null = null;
    let wait = 0;
    let begin: (() => void) | null = null;
    const down = (e: PointerEvent) => {
      if (e.button || !carried() || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      // the next-project link at the foot of a project page holds its cover in .pj-nx or the full stage, whichever is showing
      const ph = [...((e.target as Element).closest('.v3 a[href^="/portfolio/"]')?.querySelectorAll<HTMLElement>(".ph, .pj-nx, .pj-stage") ?? [])].find((n) => n.offsetWidth);
      press?.cancel();
      press = null;
      window.clearTimeout(wait);
      const start = () => ((begin = null), (press = ph?.animate({ scale: ["1", "0.975", "1.035"], offset: [0, 0.22, 1], easing: "cubic-bezier(.23,1,.32,1)" }, { duration: 560, fill: "forwards" }) ?? null));
      if (e.pointerType !== "touch") return void start();
      begin = start;
      wait = window.setTimeout(start, 90);
    };
    // Let go without opening anything (a drag, a release off the photo, a scroll): back to rest. A click has taken the press by then.
    // A finger's click can come a task or more after its pointerup (iOS), so there the press holds 300ms for it.
    const up = (e: Event) => {
      window.clearTimeout(wait);
      const tap = e.type === "pointerup" && (e as PointerEvent).pointerType === "touch";
      if (tap) begin?.();
      begin = null;
      const mine = press;
      window.setTimeout(() => press === mine && (press?.cancel(), (press = null)), tap ? 300 : 0);
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", up, true);
    document.addEventListener("dragstart", up, true);
    document.addEventListener("click", click, true);
    // PageTransition mounts first (app/layout.tsx), so its capture listener runs before this one: it stops a Back and
    // dispatches it again inside its view transition, and this listener acts on that replay.
    window.addEventListener("popstate", pop, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", up, true);
      document.removeEventListener("dragstart", up, true);
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
    const box = (r: DOMRect) => ({ left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    // A fixed copy flies from one box to the other; its box animates (not a
    // scale), so the crop never stretches. `to` is hidden until it lands.
    // `zin`: the photo starts as it sat in its frame and eases flat. `zout`: it ends as the frame it lands in holds it.
    const flyCopy = (from: DOMRect, src: string, to: HTMLElement, duration: number, easing: string, zin?: Zoom, zout?: Zoom) => {
      const h = to.getBoundingClientRect();
      const c = document.createElement("div");
      c.setAttribute("aria-hidden", "");
      Object.assign(c.style, { position: "fixed", zIndex: "60", overflow: "hidden", borderRadius: "4px", pointerEvents: "none", left: `${h.left}px`, top: `${h.top}px`, width: `${h.width}px`, height: `${h.height}px` });
      const img = c.appendChild(document.createElement("img"));
      img.alt = "";
      img.src = src;
      Object.assign(img.style, { width: "100%", height: "100%", objectFit: "cover", display: "block" });
      document.body.append(c);
      if (zin || zout) c.firstElementChild!.animate([zin ?? FLAT, zout ?? FLAT], { duration, easing, fill: "forwards" });
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
    if (b && Date.now() - b.t < 4000) {
      const main = document.getElementById("main");
      // not the home: it puts back its own spot (components/home/back.ts) and lands at rest, a 2.5vh settle there read as the row arriving late (Julian, #1351)
      if (main && path !== "/" && !(document as Document & { activeViewTransition?: unknown }).activeViewTransition) {
        main.animate({ transform: ["translateY(-2.5vh)", "none"] }, { duration: 400, easing: "cubic-bezier(.32,.72,0,1)" });
        main.animate({ opacity: [0, 1] }, { duration: 400, easing: OUT });
      }
      const go = b.hero;
      if (!go) return;
      const home = () => {
        const tile = document.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(go.slug)}"]`);
        const r = tile?.getBoundingClientRect();
        if (!tile || !r?.width) return void (++n < 30 && (raf = requestAnimationFrame(home)));
        if (onScreen(r)) flyCopy(go.r, go.src, tile, 600, MOVE, undefined, zoomOf(tile.querySelector("img")));
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
      // Found in the layout phase, the hero is named before the new page is captured; found later, the copy flies as before.
      if (f.vt && !n) {
        // The page left is already captured. A frame that outlives the trip (project to project) must not hold the name too: two of one name and the browser skips the trip.
        unnameSource();
        const hi = hero.querySelector("img");
        const cover = !f.photo || photo(hi) === f.photo;
        if (cover) {
          named(hero);
          // Edge to edge: the long tail of the drawer curve left bars at the sides while it crept the last few px.
          if (hero.closest(".pj-hero.bleed") && matchMedia("(min-width:901px)").matches) {
            document.documentElement.dataset.flyWide = "";
            undo.push(() => delete document.documentElement.dataset.flyWide);
          }
          /* The hero's own file is rarely here yet. Until it is, the frame shows the picture already on screen,
             at the hero's crop, so what lands is what stays: the tile's tighter crop stretched into the frame
             stepped out when the file arrived. Left in place; the file loads over the same picture. */
          hero.style.background = `url("${f.src}") center / cover no-repeat`;
        } else document.documentElement.dataset.fly = "away";
        if (!cover) slideUp(hero, 0);
        const trip = (document as Document & { activeViewTransition?: { finished: Promise<void> } | null }).activeViewTransition;
        if (trip) trip.finished.finally(settle);
        else window.setTimeout(settle, 1500);
      } else {
        settle();
        flyCopy(f.r, f.src, hero, 600, MOVE, f.z);
      }
      // The project's other frames on screen rise in as the hero lands (pick 2c). On trial: they slide up instead, no fade.
      [...document.querySelectorAll<HTMLElement>(".v3 .pj-r")]
        .filter((e) => !e.contains(hero) && !hero.contains(e) && onScreen(e.getBoundingClientRect()))
        .slice(0, 6)
        .forEach((e, i) => f.vt ? slideUp(e, i + 1) : e.animate({ opacity: [0, 1], transform: ["translateY(16px)", "none"] }, { duration: 600, delay: 300 + i * 40, easing: OUT, fill: "backwards" }));
    };
    land();
    return () => cancelAnimationFrame(raf);
  }, [path]);

  return null;
}
