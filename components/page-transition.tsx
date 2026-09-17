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
    const set = (way: "in" | "out") => {
      root.dataset.nav = way;
      window.clearTimeout(clear);
      clear = window.setTimeout(() => delete root.dataset.nav, 1200);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey)
        return;
      const a = (e.target as Element | null)?.closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (!a || a.target === "_blank" || a.origin !== location.origin) return;
      if (a.pathname === location.pathname) return;
      /* A crumb ("← All work") and any link marked so are the way out; the
         wordmark too, since home is where every trip started. */
      const out =
        a.dataset.back !== undefined ||
        a.textContent?.trimStart().startsWith("←") ||
        a.pathname === "/";
      set(out ? "out" : "in");
    };
    const onPop = () => set("out");
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
