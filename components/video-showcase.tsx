"use client";

import * as React from "react";
import { VideoGrid } from "@/components/video-grid";
import { VideoViewer } from "@/components/video-viewer";
import type { Video } from "@/lib/videos";

/* ── the films, by section, with one viewer over them ─────────────
 * The page is a server component; the viewer is state. This is the client
 * half that holds which film is open, so every section's grid opens into
 * the same viewer and the row under the player can offer every film on
 * the page, not only its own section's.
 * ─────────────────────────────────────────────────────────────── */

export function VideoShowcase({
  sections,
}: {
  sections: { id: string; name: string; films: Video[] }[];
}) {
  const [open, setOpen] = React.useState<Video | null>(null);
  const all = sections.flatMap((s) => s.films);

  return (
    <>
      <div className="mt-8 flex flex-col gap-16">
        {sections.map((section) =>
          // A section with nothing in it is left out rather than drawn
          // empty: a heading over blank space reads as something failing
          // to load.
          section.films.length ? (
            <section key={section.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border pb-3">
                <h2 className="font-display text-xl uppercase tracking-[0]">
                  {section.name}
                </h2>
                <p className="label text-muted-foreground">
                  {section.films.length}{" "}
                  {section.films.length === 1 ? "film" : "films"}
                </p>
              </div>
              <VideoGrid videos={section.films} onOpen={setOpen} />
            </section>
          ) : null,
        )}
      </div>

      <VideoViewer videos={all} current={open} onChange={setOpen} />
    </>
  );
}
