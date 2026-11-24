/* The pages walked in this document, kept for "Back" (components/site/back-link.tsx) and the home's return (components/home/back.ts).
   NavMemo in the root layout feeds it each path; the popstate listener goes in on first use. */

/** The pages walked in this document and where it stands among them. A link adds a page after the current one;
    browser Back and Forward only move the place. Counting every change as a step forward sent "Back" off the
    site after a browser Back to the page the visit began on. */
export function walk(pages: string[], at: number, path: string, popped: boolean): [string[], number] {
  if (!popped) return [[...pages.slice(0, at + 1), path], at + 1];
  if (pages[at - 1] === path) return [pages, at - 1];
  if (pages[at + 1] === path) return [pages, at + 1];
  return [pages, at]; // a history entry from before this document: place unknown, so not counted
}

let pages: string[] = [],
  at = 0,
  popped = false,
  listening = false,
  poppedTo = "";

// Back or Forward to another page; a hash or query step on the same page is not a move.
const pop = () => {
  popped = location.pathname !== pages[at];
  poppedTo = popped ? location.pathname : "";
};

/** Hears Back and Forward from now on. Idempotent. */
export function listenNav() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  addEventListener("popstate", pop);
}

/** A client navigation landed on `path`. */
export function notePath(path: string) {
  listenNav();
  if (!pages.length) pages = [path];
  else if (path !== pages[at]) [pages, at] = walk(pages, at, path, popped); // not the same page again (dev runs effects twice)
  popped = false;
}

/** Whether the page now showing was reached by Back or Forward. True once: the first reader clears it. */
export function takePop() {
  listenNav();
  const hit = poppedTo !== "" && poppedTo === location.pathname;
  poppedTo = "";
  return hit;
}

/** Whether the page before this one in this tab was on this site. */
export function cameFromSite() {
  // Where the browser has it, the entry's own index: this site's entries in this tab, a reload included.
  const entry = (window as { navigation?: { currentEntry?: { index: number } | null } }).navigation?.currentEntry;
  if (entry) return entry.index > 0;
  // A tab opened from the site (cmd or middle click) has the referrer but no history to go back to.
  return at > 0 || (history.length > 1 && document.referrer.startsWith(location.origin + "/"));
}
