"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/* Back where they came from: a step back in history when the last page was
   on this site, the portfolio when the page was opened directly (a new tab,
   a shared link, a search result). */

/** The pages walked in this document and where it stands among them. A link adds a page after the current one;
    browser Back and Forward only move the place. Counting every change as a step forward sent "Back" off the
    site after a browser Back to the page the visit began on. */
export function walk(pages: string[], at: number, path: string, popped: boolean): [string[], number] {
  if (!popped) return [[...pages.slice(0, at + 1), path], at + 1];
  if (pages[at - 1] === path) return [pages, at - 1];
  if (pages[at + 1] === path) return [pages, at + 1];
  return [pages, at]; // a history entry from before this document: place unknown, so not counted
}

let pages: string[] = [], at = 0, popped = false;

const cameFromSite = () => {
  // Where the browser has it, the entry's own index: this site's entries in this tab, a reload included.
  const entry = (window as { navigation?: { currentEntry?: { index: number } | null } }).navigation?.currentEntry;
  if (entry) return entry.index > 0;
  // A tab opened from the site (cmd or middle click) has the referrer but no history to go back to.
  return at > 0 || (history.length > 1 && document.referrer.startsWith(location.origin + "/"));
};

/** Mounted once in the root layout: follows client navigations. */
export function NavMemo() {
  const path = usePathname();
  React.useEffect(() => {
    if (!pages.length) pages = [path];
    else if (path !== pages[at]) [pages, at] = walk(pages, at, path, popped); // not the same page again (dev runs effects twice)
    popped = false;
  }, [path]);
  React.useEffect(() => {
    // Back or Forward to another page; a hash or query step on the same page is not a move.
    const pop = () => void (popped = location.pathname !== pages[at]);
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  return null;
}

export function BackLink({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <Link
      className={className}
      href="/portfolio"
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !cameFromSite()) return;
        e.preventDefault();
        router.back();
      }}
    >
      &larr; Back
    </Link>
  );
}
