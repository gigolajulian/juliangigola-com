"use client";

import * as React from "react";
import { useWide } from "@/components/strip";
import { WorkList, type ListRow } from "@/components/work-list";
import type { Frame } from "@/lib/work-types";
import type { Video } from "@/lib/videos";
import { useWorkQuery, useWorkView } from "@/lib/work-view";
import { Vectorscope } from "@/components/vectorscope";

/* ── which of the three is showing ────────────────────────────────
 * The switch every page under `/work` stands behind: the strip or the
 * rack it was handed, or the list, or the answer to what is typed in the
 * head's viewfinder.
 *
 * The list is a different thing on the page rather than the same cells
 * laid out differently, so it replaces what it is given instead of
 * restyling it: the machine — the wheel, the drag, the ruler, the viewer
 * — is built for a row and none of it applies to a column of names.
 *
 * Julian: keep the search across the filters. So a query outranks the
 * filter you are standing on and answers from the whole archive; clearing
 * the box puts that discipline back exactly as it was. Without a query the
 * list is the page's own — `within` names the discipline, and All names
 * none.
 * ─────────────────────────────────────────────────────────────── */
export function WorkSheet({
  rows,
  mine,
  frames,
  videos,
  within,
  children,
}: {
  rows: ListRow[];
  /** The films this page can play, for the lines in `mine` that are films. */
  videos?: Video[];
  /** This page's own list, where its content is not projects: the frames
      of a gallery discipline, the sleeves of Cover art, the films. Without
      it the list is the archive rows filed under `within`. */
  mine?: ListRow[];
  /** The photographs `mine` can open in the viewer. */
  frames?: Frame[];
  /** The discipline this page shows, if it is one. */
  within?: string;
  children: React.ReactNode;
}) {
  const query = useWorkQuery();
  const view = useWorkView();
  /* Not on a phone, where the buttons that choose a view are hidden and a
     kept `list` would put up a column with no way back to the strip. */
  const wide = useWide();

  if (!wide) return <>{children}</>;
  if (query.trim()) return <WorkList rows={rows} />;
  /* The work by colour: the same rows the list would show, sorted by
     where their palettes sit on a scope. */
  if (view === "colour") {
    return (
      <Vectorscope
        rows={within ? rows.filter((r) => r.discipline === within) : rows}
      />
    );
  }
  if (view === "list") {
    if (mine)
      return <WorkList rows={mine} frames={frames} videos={videos} />;
    return (
      <WorkList
        rows={within ? rows.filter((r) => r.discipline === within) : rows}
      />
    );
  }
  return <>{children}</>;
}
