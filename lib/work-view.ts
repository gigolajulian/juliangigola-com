"use client";

import * as React from "react";
import { flushSync } from "react-dom";

/* ── how the work is being looked at ──────────────────────────────
 * Two settings shared by two components that cannot see each other: the
 * view lives on the layout's head (`work-shell.tsx`) and is read by the
 * page under it (`work-strip.tsx`), which is upwards through the tree and
 * so not something context can carry.
 *
 * A module with subscribers, read through `useSyncExternalStore`, which is
 * the hook for exactly this: the server has no `localStorage` and has to
 * draw the strip, the browser knows better a moment later, and
 * `getServerSnapshot` is what keeps the first render matching the HTML.
 * This was already the shape of the view in `work-shell.tsx`; the search
 * moved in beside it rather than inventing a second mechanism.
 *
 * The view is remembered, the search is not: the way somebody wants to
 * look at a body of work is a preference, and what they were looking for
 * last week is not.
 * ─────────────────────────────────────────────────────────────── */

export type WorkView = "strip" | "grid" | "list";

const KEY = "work-view";

let watching: (() => void)[] = [];
const tell = () => {
  for (const w of watching) w();
};

const subscribe = (onChange: () => void) => {
  watching.push(onChange);
  // The same person in another tab of the same site.
  window.addEventListener("storage", onChange);
  return () => {
    watching = watching.filter((w) => w !== onChange);
    window.removeEventListener("storage", onChange);
  };
};

const readView = (): WorkView => {
  try {
    const kept = window.localStorage.getItem(KEY);
    return kept === "grid" || kept === "list" ? kept : "strip";
  } catch {
    // Private browsing: it works, it is simply not remembered.
    return "strip";
  }
};

/** The strip, for everybody who has not said otherwise. */
const server = (): WorkView => "strip";

export const useWorkView = (): WorkView =>
  React.useSyncExternalStore(subscribe, readView, server);

export const chooseView = (next: WorkView) => {
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // As above.
  }
  tell();
};

/* Julian: changing view needs something dope. Every cover in the window
   flies from where it stands in one view to where it stands in the next,
   one a beat after the last, left to right: a View Transition with a name
   on each cover (`data-vt`, on `cover-cell.tsx` and the list's picture).
   Only the covers in sight are named, since every name is a snapshot, and
   a cover that leaves the window keeps its name so it flies out rather
   than vanishing. Not for anybody who asked for less motion. */
/** Where the work stands, to tell whether anything scrolled between two
    switches. */
const where = (): [number, number] => [
  document.querySelector(".strip-scroll")?.scrollLeft ?? 0,
  window.scrollY,
];
/** Nothing scrolled but the few pixels a strip settles by after a jump. */
const still = (a: [number, number], b: [number, number]) =>
  Math.abs(a[0] - b[0]) < 16 && Math.abs(a[1] - b[1]) < 16;
/** The last switch: the cover it kept in place, where the work stood
    before it (to go back to exactly) and where it stood after it (to tell
    whether anything scrolled since). */
let kept: {
  slug: string;
  from: [number, number];
  landed: [number, number];
} | null = null;

const RUN = 24; // covers that fly on each side of a change
const FLY = { duration: 720, easing: "cubic-bezier(0.77, 0, 0.175, 1)" };
const BEAT = 24; // ms between one cover and the next

const seen = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return (
    /* The rack is still on the page under the colour panel, hidden, and
       its covers keep their boxes. */
    el.checkVisibility({ visibilityProperty: true }) &&
    r.width > 0 &&
    r.right > 0 &&
    r.left < window.innerWidth &&
    r.bottom > 0 &&
    r.top < window.innerHeight
  );
};

/* The covers in sight and the run that follows them, in order: a strip
   shows three and the grid a dozen, so the dozen come in from just off
   the right of the strip and go back out there, the strip folding into
   the grid and out again. Julian: strip to grid and back needs better. */
const inSight = (root: ParentNode = document) => {
  const all = Array.from(root.querySelectorAll<HTMLElement>("[data-vt]"));
  const first = all.findIndex(seen);
  return first < 0 ? [] : all.slice(first, first + RUN);
};

/* Across the filters, the same flight. A filter is another page, and the
   page it leaves is hidden the moment the next one is in (`filter` in
   `globals.css`), so there is nothing for a View Transition to pair. The
   covers are measured as the chip is pressed instead, and the strip that
   mounts next (`strip.tsx`) sends each cover it shares with them from
   where it stood, and the rest in from the right. Julian: can that happen
   across the filters. */
let noted: Map<string, DOMRect> | null = null;
let notedAt = 0;
export const noteCovers = () => {
  noted = new Map(inSight().map((el) => [el.dataset.vt!, el.getBoundingClientRect()]));
  notedAt = Date.now();
};
/** Flies the covers of a strip that has just mounted, if a chip was
    pressed a moment ago. False when there was nothing to fly from. */
export const flyCovers = (root: HTMLElement) => {
  const from = noted;
  noted = null;
  if (
    !from?.size ||
    Date.now() - notedAt > 10000 ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return false;
  inSight(root).forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const o = from.get(el.dataset.vt!);
    const timing = { ...FLY, delay: Math.min(i, 14) * BEAT, fill: "backwards" as const };
    if (o && r.width && r.height)
      el.animate(
        [
          {
            transformOrigin: "0 0",
            transform: `translate(${o.left - r.left}px, ${o.top - r.top}px) scale(${o.width / r.width}, ${o.height / r.height})`,
            filter: "blur(0px)",
          },
          { transformOrigin: "0 0", filter: "blur(3px)", offset: 0.3 },
          { transformOrigin: "0 0", transform: "none", filter: "blur(0px)" },
        ],
        timing,
      );
    else
      el.animate(
        [
          { opacity: 0, transform: "translateX(40vw)" },
          { opacity: 1, transform: "none" },
        ],
        timing,
      );
  });
  return true;
};

export const morphView = (change: () => void) => {
  const doc = document as Document & {
    startViewTransition?: (update: () => Promise<void>) => ViewTransition;
  };
  if (
    !doc.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return change();
  const root = document.documentElement;
  const named = new Set<HTMLElement>();
  const beat = new Map<string, number>();
  const unname = (el: HTMLElement) => {
    el.style.removeProperty("view-transition-name");
    el.style.removeProperty("view-transition-class");
  };
  const put = (el: HTMLElement, taken: Set<string>) => {
    // A frame is named by its file, which is not a name CSS will take.
    const n = `vt-${el.dataset.vt!.replace(/[^\w-]/g, "-")}`;
    if (taken.has(n)) return;
    taken.add(n);
    el.style.setProperty("view-transition-name", n);
    el.style.setProperty("view-transition-class", "view");
    named.add(el);
    if (!beat.has(n)) beat.set(n, beat.size);
  };
  const before = new Set<string>();
  const was = inSight();
  for (const el of was) put(el, before);
  /* The cover the switch keeps in place. Coming straight back (nothing
     scrolled since the last switch) it is the one that switch kept, set
     back exactly where it stood, so strip to grid and back is the same
     projects in the same places. Julian: retain the position and the
     projects on the page. Otherwise it is the first cover in sight. */
  const again = kept && still(kept.landed, where()) ? kept : null;
  const anchor = again?.slug ?? was[0]?.dataset.vt;
  const held = anchor
    ? document.querySelector<HTMLElement>(`[data-vt="${CSS.escape(anchor)}"]`)
    : null;
  const leftAt = held?.getBoundingClientRect();
  const from = where();
  const style = document.createElement("style");
  root.dataset.nav = "view";
  const trip = doc.startViewTransition(async () => {
    flushSync(change);
    /* The deck (`lib/deck.ts`) pins the cells again for the new layout
       from a MutationObserver, after this has run: let it, or the cover
       is lined up by where the old view's pins left it. Measured: 84px
       out on the way back to the grid. */
    await new Promise((r) => setTimeout(r));
    /* Coming straight back: the work exactly where it was left, which
       is the same projects in the same places. Lined up by a cover it was
       not: the deck scales a pinned card as the scroll moves, after this,
       and a cover lined up by its box came back 84px out. */
    const row = document.querySelector<HTMLElement>(".strip-scroll");
    const mark = anchor
      ? document.querySelector<HTMLElement>(`[data-vt="${CSS.escape(anchor)}"]`)
      : null;
    if (again && row) {
      row.scrollLeft = again.from[0];
    } else if (mark && !mark.closest(".strip-scroll")) {
      // The list, which scrolls in its own box: the cover to the middle.
      mark.scrollIntoView({ block: "center", behavior: "instant" });
    } else {
      /* Wherever you were: the cover you were looking at stands where it
         stood, so the flight is from where you were, not to the start of
         the page. Twice, since a pinned cell moves with the scroll it is
         lined up by. */
      for (let pass = 0; mark && row && leftAt && pass < 2; pass++)
        row.scrollLeft += mark.getBoundingClientRect().left - leftAt.left;
    }
    kept = anchor ? { slug: anchor, from, landed: where() } : null;
    const flown = Array.from(named).filter((el) => el.isConnected);
    named.forEach(unname);
    named.clear();
    beat.clear();
    const after = new Set<string>();
    for (const el of inSight()) put(el, after);
    for (const el of flown) put(el, after);
    style.textContent = Array.from(beat, ([n, i]) => {
      const at = `${Math.min(i, 14) * BEAT}ms`;
      return `::view-transition-group(${n}),::view-transition-image-pair(${n}),::view-transition-old(${n}),::view-transition-new(${n}){animation-delay:${at}}`;
    }).join("");
    document.head.append(style);
  });
  trip.finished.finally(() => {
    named.forEach(unname);
    style.remove();
    if (root.dataset.nav === "view") delete root.dataset.nav;
  });
};

/* What is being searched for, and the view to go back to when the box is
   emptied. Searching is a list — a query answered as a ribbon of covers
   would have the answer somewhere off the side of the window — so typing
   switches to it and clearing puts back whatever was showing before. */
let query = "";
let before: WorkView | null = null;

const readQuery = () => query;
const noQuery = () => "";

export const useWorkQuery = (): string =>
  React.useSyncExternalStore(subscribe, readQuery, noQuery);

export const search = (next: string) => {
  const had = query.trim() !== "";
  const has = next.trim() !== "";
  query = next;
  if (has && !had) {
    before = readView();
    chooseView("list");
    return;
  }
  if (!has && had && before) {
    const back = before;
    before = null;
    chooseView(back);
    return;
  }
  tell();
};
