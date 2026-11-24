"use client";

import * as React from "react";
import type { SitemapTarget } from "@/components/admin/admin-sitemap";
import { FIELD_TAB, TABS, type View } from "@/components/admin/editor/tabs";

/**
 * Where the editor is: the tab, the expanded project row, the project list's
 * filter and a Content field asked for. `go` sends it to anything the sitemap
 * can name.
 */
export function useEditorNav() {
  const [view, setView] = React.useState<View>("home");
  // `?view=projects`: the One Desk's Site links land on their tab. After hydration, so the first paint matches.
  React.useEffect(() => {
    const v = new URLSearchParams(location.search).get("view");
    if (TABS.flat().some((x) => x.id === v)) queueMicrotask(() => setView(v as View));
  }, []);
  /**
   * The project whose row is expanded, if any.
   *
   * Held here rather than in `AdminProjects` so the sitemap can open one. The
   * sitemap is the index of the site and is on screen at all times, which
   * makes it the natural way in to a project: clicking a cover there opens
   * that project's row instead of sending you to the published page and
   * abandoning the draft.
   */
  const [opened, setOpened] = React.useState<string | null>(null);
  /** The project list's filter, held here so a discipline row can set it. */
  const [filter, setFilter] = React.useState("");
  /**
   * A Content field the sitemap has asked for, cleared once it is reached.
   *
   * Held as a counter alongside the anchor so clicking the same row twice
   * scrolls twice: an anchor compared by value would look unchanged the
   * second time and do nothing.
   */
  const [wanted, setWanted] = React.useState<{
    anchor: string;
    nonce: number;
  } | null>(null);

  /**
   * Sends the editor to a project, from anywhere that can name one.
   *
   * Switches to the Projects view first, because the sitemap is on screen in
   * both and clicking a cover while the content form is showing would open a
   * row nobody can see.
   */
  const go = React.useCallback((target: SitemapTarget) => {
    if (target.kind === "project") {
      setView("projects");
      setFilter("");
      setOpened(target.slug);
      return;
    }
    if (target.kind === "projects") {
      setView("projects");
      setOpened(null);
      // The list already filters on name, slug and discipline, so the
      // discipline's own label is the filter, no second mechanism needed.
      setFilter(target.discipline ?? "");
      return;
    }
    // A field is behind a tab now, so a jump is two moves: switch to the tab
    // that holds it, then scroll to it. Unmapped anchors fall back to Home
    // rather than leaving you on whatever tab you were on, which would look
    // like the click did nothing.
    setView(FIELD_TAB[target.anchor] ?? "home");
    setWanted((w) => ({ anchor: target.anchor, nonce: (w?.nonce ?? 0) + 1 }));
  }, []);

  return { view, setView, opened, setOpened, filter, setFilter, wanted, go };
}
