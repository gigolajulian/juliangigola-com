"use client";

import * as React from "react";
import { ViewTransition } from "react";
import { usePathname } from "next/navigation";
import { filterPaths } from "@/lib/utils";

/* ── one page becomes the next by zooming ─────────────────────────
 * Julian asked for it: opening a page should read as zooming into it, and
 * leaving one as zooming back out. The boundary wraps every page's content
 * in the root layout; a navigation is a React transition, so when the page
 * inside it changes the browser snapshots the old one and the new one and
 * `globals.css` scales them past each other (`.page` there). The header
 * and footer sit outside the boundary and stay put.
 *
 * Which way is which is a data attribute on the root, written before the
 * navigation runs: a press on a link is a step in, a crumb or the browser's
 * back button a step out. `globals.css` reads `data-nav`. Removed once the
 * trip is over, so a theme flip or a filter change never inherits it.
 * ─────────────────────────────────────────────────────────────── */
const clearNav = () => {
  const root = document.documentElement;
  // A strip dealt across pages clears its own (`leave` in `strip.tsx`).
  if (root.dataset.nav === "deal") return;
  delete root.dataset.nav;
  delete root.dataset.navBar;
  delete root.dataset.navDrawer;
  delete root.dataset.navSide;
};

/* The bar's order, left to right, the wordmark first. A press in the bar
   travels along it: to the right of the page you are on, the pages move
   right to left, and back the other way. Julian: a transition for each
   page from the navbar. A project or a filter counts as its section. */
const SECTIONS = ["/", "/portfolio"];

/** Ends a held pop's snapshot once the page it went to has rendered. */
let landed: (() => void) | null = null;
const sectionOf = (path: string) =>
  SECTIONS.reduce(
    (found, s, i) => (path === s || (s !== "/" && path.startsWith(`${s}/`)) ? i : found),
    -1,
  );

export function PageTransition({ children }: { children: React.ReactNode }) {
  /* Over when the trip lands, not on a clock from the press. The page's
     animations are read off the root while they run, and a page slower
     than the clock (a cold Worker, a route compiling on dev) lost its
     way halfway and fell back to the browser's own crossfade. */
  const path = usePathname();
  const shown = React.useRef(path);
  React.useLayoutEffect(() => {
    shown.current = path;
    landed?.();
    landed = null;
    if (document.documentElement.dataset.nav === undefined) return;
    const trip = (
      document as Document & {
        activeViewTransition?: { finished: Promise<void> } | null;
      }
    ).activeViewTransition;
    if (trip) {
      trip.finished.finally(clearNav);
      return;
    }
    const t = window.setTimeout(clearNav, 1400);
    return () => window.clearTimeout(t);
  }, [path]);

  React.useEffect(() => {
    const root = document.documentElement;
    let clear = 0;
    const set = (
      way: "in" | "out" | "filter",
      from: "page" | "bar" | "drawer" = "page",
    ) => {
      root.dataset.nav = way;
      /* Kept for the visit: a page reached by a press is not a cold load,
         and the cover's entrance starts at once (`globals.css`). */
      root.dataset.moved = "";
      /* Julian asked for a beat before the page arrives when the press
         came from the bar. A link inside the page is a step through the
         work and wants no waiting; the bar is a jump across the site, and
         the old page is given the room to leave before the new one comes
         up. `globals.css` reads it as a delay on the incoming page.

         A drawer is the same jump with a door to shut first. The menu and
         the filters take 420ms to travel back out, and the four links in
         the menu used to be inside `<header>` and so counted as the bar;
         they are their own component now, which quietly took the beat away
         and let the new page land under a drawer that was still moving.
         Julian saw it. The longer wait is the drawer's own journey plus
         one, so the page arrives at a still screen. */
      if (from === "page") {
        delete root.dataset.navBar;
        delete root.dataset.navDrawer;
      } else {
        root.dataset.navBar = "";
        if (from === "drawer") root.dataset.navDrawer = "";
        else delete root.dataset.navDrawer;
      }
      // Only for a press that never lands; the arrival clears it above.
      window.clearTimeout(clear);
      clear = window.setTimeout(clearNav, 10000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey)
        return;
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (!a || a.target === "_blank" || a.origin !== location.origin) return;
      if (a.pathname === location.pathname) return;
      /* A chip on the work index is a filter, not a page: /work, a
         category and the motion page are one page with one row swapped,
         and the strip already fades the row (`data-arrive="fade"`). The
         zoom on top of it read as the whole site reloading. */
      const index = filterPaths();
      if (index.has(a.pathname) && index.has(location.pathname)) {
        set("filter");
        return;
      }
      /* A crumb ("← All work") and any link marked so are the way out; the
         wordmark too, since home is where every trip started. */
      const out =
        a.dataset.back !== undefined ||
        a.textContent?.trimStart().startsWith("←") ||
        a.pathname === "/";
      const from = a.closest(".drawer")
        ? "drawer"
        : a.closest("header")
          ? "bar"
          : "page";
      set(out ? "out" : "in", from);
      const here = sectionOf(location.pathname);
      /* Portfolio leads the bar (Julian, 2026-09-30), so the homepage's
         own screens (Sessions, About, Contact) sit to its right; only the
         wordmark's home is to its left. */
      const there =
        a.pathname === "/" && a.hash ? SECTIONS.length : sectionOf(a.pathname);
      if (
        from !== "page" &&
        a.pathname !== location.pathname &&
        here >= 0 &&
        there >= 0 &&
        here !== there
      )
        root.dataset.navSide = there > here ? "right" : "left";
      else delete root.dataset.navSide;
    };
    // The photo viewer keeps an entry in the history so the back button
    // closes it (`lib/zoom.ts`); that pop is not a page leaving. Read by
    // the path, not by the viewer's flag: closing it with Esc or Close
    // takes the flag down before its own `history.back()` pops, and the
    // root was left saying "out" for ten seconds.
    /* Julian (2026-10-04): going back needs its animation too. React
       starts no view transition for a pop, so it was a cut. The pop is
       held here, before the router's own listener, the page snapshotted,
       and the pop handed back inside the transition; `globals.css` drops
       the page left and settles the one returned to (`back-page`). */
    let replaying = false;
    const onPop = (e: PopStateEvent) => {
      if (replaying || location.pathname === shown.current) return;
      set("out");
      const ua = (e as PopStateEvent & { hasUAVisualTransition?: boolean })
        .hasUAVisualTransition;
      if (ua || !document.startViewTransition) return;
      e.stopImmediatePropagation();
      const main = document.getElementById("main");
      main?.style.setProperty("view-transition-name", "back-page");
      const trip = document.startViewTransition(
        () =>
          new Promise<void>((done) => {
            landed = done;
            replaying = true;
            window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
            replaying = false;
            // A page that takes longer than this lands after the trip.
            window.setTimeout(done, 1500);
          }),
      );
      trip.finished.finally(() => {
        main?.style.removeProperty("view-transition-name");
        clearNav();
      });
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop, true);
      window.clearTimeout(clear);
    };
  }, []);

  return (
    <ViewTransition update="page" default="none">
      {children}
    </ViewTransition>
  );
}
