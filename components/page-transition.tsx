"use client";

import * as React from "react";
import { ViewTransition } from "react";

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
export function PageTransition({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const root = document.documentElement;
    let clear = 0;
    const set = (
      way: "in" | "out" | "filter",
      from: "page" | "bar" | "drawer" = "page",
    ) => {
      root.dataset.nav = way;
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
      window.clearTimeout(clear);
      clear = window.setTimeout(() => {
        delete root.dataset.nav;
        delete root.dataset.navBar;
        delete root.dataset.navDrawer;
      }, 1400);
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
      const index = (path: string) =>
        path === "/work" ||
        path === "/work/video" ||
        path.startsWith("/work/category/");
      if (index(a.pathname) && index(location.pathname)) {
        set("filter");
        return;
      }
      /* A crumb ("← All work") and any link marked so are the way out; the
         wordmark too, since home is where every trip started. */
      const out =
        a.dataset.back !== undefined ||
        a.textContent?.trimStart().startsWith("←") ||
        a.pathname === "/";
      set(
        out ? "out" : "in",
        a.closest(".drawer") ? "drawer" : a.closest("header") ? "bar" : "page",
      );
    };
    // The photo viewer keeps an entry in the history so the back button
    // closes it (`lib/zoom.ts`); that pop is not a page leaving.
    const onPop = () => {
      if (root.dataset.viewer === undefined) set("out");
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
      window.clearTimeout(clear);
    };
  }, []);

  return (
    <ViewTransition update="page" default="none">
      {children}
    </ViewTransition>
  );
}
