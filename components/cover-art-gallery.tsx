"use client";

import * as React from "react";
import { Lightbox, useLightbox } from "@/components/lightbox";
import { CoverFaces, coverLabel } from "@/components/cover-faces";
import type { CoverRelease } from "@/lib/cover-art-types";

/* ── the cover-art sheet ──────────────────────────────────────────
 * Every release, three across.
 *
 * Not the project-gallery layout, because this is not a sequence — it is a
 * catalogue. Twenty-four releases laid out two-up at full width is a scroll
 * with one cover per screen, and a cover is a thing you scan a rack of. Three
 * columns, seamless, is that rack.
 *
 * One cell per release. A sleeve shows side A and turns over on hover, rather
 * than taking two cells — so every cover is the same size as every other, and
 * twenty-four divides both column counts exactly, which leaves no gap in a
 * grid that has no gaps anywhere else.
 * ─────────────────────────────────────────────────────────────── */

export function CoverArtGallery({ releases }: { releases: CoverRelease[] }) {
  // The lightbox pages through every side in order, so arrowing off side A
  // lands on side B rather than skipping to the next release.
  const frames = React.useMemo(() => releases.flatMap((r) => r.frames), [releases]);
  const lightbox = useLightbox(frames.length);

  // A cell opens at its own position in that flat sequence. Keyed by `src`,
  // which is unique per side.
  const positions = React.useMemo(() => new Map(frames.map((f, i) => [f.src, i])), [frames]);

  return (
    <>
      <ul className="mt-12 grid grid-cols-2 sm:mt-16 sm:grid-cols-3">
        {releases.map((release, i) => {
          const front = release.frames[0];
          if (!front) return null;

          return (
            <li key={release.slug}>
              <button
                type="button"
                onClick={(e) => {
                  // Open whichever side is on screen. `:hover` is the same
                  // thing the crossfade is keyed on, so the lightbox shows the
                  // cover that was actually clicked — and a keyboard Enter,
                  // where nothing is hovered, opens side A.
                  const turned =
                    release.frames.length > 1 && e.currentTarget.matches(":hover");
                  const frame = release.frames[turned ? 1 : 0];
                  lightbox.show(positions.get(frame.src) ?? 0);
                }}
                aria-label={`Open ${coverLabel(release.title, release.artist, release.frames)}`}
                className="group relative block aspect-square w-full cursor-zoom-in overflow-hidden press active:scale-[0.995]"
                style={{ backgroundColor: front.color }}
              >
                <CoverFaces
                  frames={release.frames}
                  sizes="(min-width: 640px) 33vw, 50vw"
                  // The top row, eagerly — it is the largest thing above the
                  // fold. The rest of the rack loads as it is reached.
                  priority={i < 3}
                />

                {/* The release, named on hover or on focus. A rack of covers
                    is scanned for a name you recognise. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-background/90 to-transparent p-4 pb-7 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                  <span className="label text-foreground">{release.title}</span>
                  <span className="label text-muted-foreground">{release.artist}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <Lightbox frames={frames} name="Cover art" {...lightbox} />
    </>
  );
}
