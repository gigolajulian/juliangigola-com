"use client";

import * as React from "react";
import Link from "next/link";
import { Strip, type Lead } from "@/components/strip";
import { VideoGrid } from "@/components/video-grid";
import { VideoViewer } from "@/components/video-viewer";
import { VideoHero } from "@/components/video-hero";
import { REEL, type Video } from "@/lib/videos";

/* ── the films, along the strip, with one viewer over them ────────
 * The page is a server component; the viewer is state. This is the client
 * half that holds which film is open, so every section's tiles open into
 * the same viewer and the row under the player can offer every film on
 * the page, not only its own section's.
 *
 * It renders the strip itself rather than handing cells up: the strip
 * reads its cells as direct children, and a fragment of cells from a
 * component would be one child to it and many to the DOM.
 * ─────────────────────────────────────────────────────────────── */

export function VideoShowcase({
  sections,
  next,
  ask,
}: {
  sections: { id: string; name: string; films: Video[] }[];
  /** Where the wheel goes past the ask. */
  next?: Lead;
  /** The last cell, an `EnquiryCell`. */
  ask: React.ReactNode;
}) {
  const [open, setOpen] = React.useState<Video | null>(null);
  const all = sections.flatMap((s) => s.films);

  const cells: React.ReactNode[] = [
    /* The reel first, filling the strip's height and most of a screen
       across, playing muted with its own sound and fullscreen controls.
       Julian asked for the reel to open the page. */
    <div
      key="reel"
      data-tick
      data-label="Reel"
      data-hash="reel"
      className="relative w-full shrink-0 overflow-hidden max-sm:aspect-video sm:h-full sm:w-[calc(100vw-5rem)]"
    >
      <VideoHero videoId={REEL.videoId} title={REEL.title} year={REEL.year} />
    </div>,
  ];

  if (!all.length) {
    cells.push(
      /* Not an error state and not a placeholder pretending to be work.
         Until a link is pasted into /admin the page says so plainly and
         sends the visitor to the stills. */
      <div
        key="none"
        className="flex w-full shrink-0 flex-col justify-center py-10 sm:h-full sm:w-[min(28rem,70vw)] sm:py-0 sm:pl-10"
      >
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          The rest of the moving work is not up here yet.{" "}
          <Link
            href="/contact"
            className="text-foreground underline decoration-border underline-offset-4 hoverable:hover:decoration-foreground"
          >
            Ask for more
          </Link>{" "}
          and it comes back the same day.
        </p>
      </div>,
    );
  }

  for (const section of sections) {
    // A section with nothing in it is left out rather than drawn empty: a
    // heading over blank space reads as something failing to load.
    if (!section.films.length) continue;
    cells.push(
      <div
        key={`${section.id}-head`}
        data-tick
        data-label={section.name}
        data-hash={section.id}
        /* The column is at least 18rem and as much more as the word needs.
           A fixed 18rem is 248px of room once the gutter is taken, and
           COMMERCIAL set in the display face at 48px is 285px: the word ran
           out of its own cell and printed itself over the films standing
           next to it. Nothing here is long enough to want a cap. */
        className="flex w-full shrink-0 flex-col justify-center gap-2 py-10 sm:h-full sm:w-max sm:min-w-[min(18rem,40vw)] sm:py-0 sm:pl-10 sm:pr-10"
      >
        <h2 className="font-display text-3xl uppercase leading-[0.95] tracking-[0] sm:text-5xl">
          {section.name}
        </h2>
        <p className="label text-muted-foreground">
          {section.films.length}{" "}
          {section.films.length === 1 ? "film" : "films"}
        </p>
      </div>,
      <div key={section.id} className="w-full shrink-0 sm:h-full sm:w-auto">
        <VideoGrid videos={section.films} onOpen={setOpen} rows />
      </div>,
    );
  }

  cells.push(ask);

  return (
    <>
      <Strip
        label={`Motion: ${all.length + 1} films, left and right`}
        next={next}
        className="mt-4 flex-1"
      >
        {cells}
      </Strip>

      <VideoViewer videos={all} current={open} onChange={setOpen} />
    </>
  );
}
