"use client";

import * as React from "react";
import { Strip, useWide } from "@/components/strip";
import { Lightbox, useLightbox } from "@/components/lightbox";
import type { Frame } from "@/lib/work-types";
import { WorkList, type ListRow } from "@/components/work-list";
import { useWorkView } from "@/lib/work-view";

/* ── the work index, with a viewer under it ───────────────────────
 * Four disciplines are photographs put straight on the page rather than
 * projects with pages of their own: Event coverage, Automotive, Places.
 * Their frames run out along the index, and Julian asked that pressing one
 * there open it where a photograph opens everywhere else on the site —
 * the viewer, not a page.
 *
 * So the index's strip is wrapped rather than rebuilt: the cells are still
 * built on the server and handed through, and this adds the one thing a
 * server component cannot pass, which is the function the strip calls when
 * a numbered cell is pressed.
 * ─────────────────────────────────────────────────────────────── */
export function WorkStrip({
  frames,
  label,
  marks,
  rows,
  className,
  children,
}: {
  /** Every gallery frame on the page, in the order they are laid out; a
      cell's `data-n` is its place in here. */
  frames: Frame[];
  label: string;
  marks?: Record<string, React.ReactNode>;
  /** The same work as lines, for the list view and the search. */
  rows?: ListRow[];
  className?: string;
  children: React.ReactNode;
}) {
  const lightbox = useLightbox(frames);
  /* The list is a different thing on the page rather than the same cells
     laid out differently, so it replaces the strip instead of restyling
     it: the machine — the wheel, the drag, the ruler, the viewer — is
     built for a row and none of it applies to a column of names. */
  const view = useWorkView();
  /* Not on a phone, where the buttons that choose a view are hidden: a
     kept `list` would put up a column with no way back to the strip. */
  const wide = useWide();
  if (rows && wide && view === "list") return <WorkList rows={rows} />;

  return (
    <>
      <Strip
        label={label}
        marks={marks}
        onOpen={lightbox.show}
        // Twelve disciplines and eighty four covers: the one ruler on the
        // site that is a table of contents rather than a row of stops.
        chapters
        className={className}
      >
        {children}
      </Strip>

      <Lightbox frames={frames} name="The work" {...lightbox} />
    </>
  );
}
