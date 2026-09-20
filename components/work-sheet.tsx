"use client";

import * as React from "react";
import { useWide } from "@/components/strip";
import { WorkList, type ListRow } from "@/components/work-list";
import { useWorkQuery, useWorkView } from "@/lib/work-view";

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
  within,
  children,
}: {
  rows: ListRow[];
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
  if (view === "list") {
    return (
      <WorkList
        rows={within ? rows.filter((r) => r.discipline === within) : rows}
      />
    );
  }
  return <>{children}</>;
}
