"use client";

import * as React from "react";

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

export type WorkView = "strip" | "grid" | "list" | "colour";

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
    return kept === "grid" || kept === "list" || kept === "colour"
      ? kept
      : "strip";
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
