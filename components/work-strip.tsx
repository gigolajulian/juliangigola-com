"use client";

import * as React from "react";
import { Strip } from "@/components/strip";
import { Lightbox, useLightbox } from "@/components/lightbox";
import type { Frame } from "@/lib/work-types";

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
  className,
  children,
}: {
  /** Every gallery frame on the page, in the order they are laid out; a
      cell's `data-n` is its place in here. */
  frames: Frame[];
  label: string;
  marks?: Record<string, React.ReactNode>;
  className?: string;
  children: React.ReactNode;
}) {
  const lightbox = useLightbox(frames);

  return (
    <>
      <Strip
        label={label}
        marks={marks}
        onOpen={lightbox.show}
        className={className}
      >
        {children}
      </Strip>

      <Lightbox frames={frames} name="The work" {...lightbox} />
    </>
  );
}
