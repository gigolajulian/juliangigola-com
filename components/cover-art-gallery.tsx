"use client";

import * as React from "react";
import Image from "next/image";
import { Lightbox, useLightbox } from "@/components/lightbox";
import type { CoverRelease } from "@/lib/cover-art-types";

/* ── the cover-art sheet ──────────────────────────────────────────
 * Every release, three across.
 *
 * Not the project-gallery layout, because this is not a sequence — it is a
 * catalogue. Twenty-four releases laid out two-up at full width is a scroll
 * with one cover per screen, and a cover is a thing you scan a rack of. Three
 * columns, seamless, is that rack.
 *
 * A release with two sides is one cell holding both, stacked, side A above
 * side B — how the sleeve itself is read, and the only arrangement where the
 * two halves are unmistakably one record rather than two covers that happen
 * to be adjacent.
 * ─────────────────────────────────────────────────────────────── */

export function CoverArtGallery({ releases }: { releases: CoverRelease[] }) {
  // The lightbox pages through every side in order, so arrowing off side A
  // lands on side B rather than skipping to the next release.
  const frames = React.useMemo(() => releases.flatMap((r) => r.frames), [releases]);
  const lightbox = useLightbox(frames.length);

  // Each cover is its own target, so a cell needs its frame's position in the
  // flat sequence. Keyed by `src`, which is unique per side.
  const positions = React.useMemo(
    () => new Map(frames.map((f, i) => [f.src, i])),
    [frames],
  );

  return (
    <>
      <ul className="mt-12 grid grid-cols-2 sm:mt-16 sm:grid-cols-3">
        {releases.map((release, r) => {
          const sleeve = release.frames.length > 1;

          return (
            <li
              key={release.slug}
              // Two rows deep for a sleeve, one column wide either way.
              className={sleeve ? "group relative row-span-2" : "group relative"}
            >
              <div className={sleeve ? "grid grid-rows-2" : undefined}>
                {release.frames.map((frame, side) => {
                  const i = positions.get(frame.src) ?? 0;

                  return (
                    <button
                      key={frame.src}
                      type="button"
                      onClick={() => lightbox.show(i)}
                      aria-label={`Open ${release.title} by ${release.artist}${
                        frame.side ? `, ${frame.side.toLowerCase()}` : ""
                      }`}
                      className="relative block aspect-square w-full cursor-zoom-in overflow-hidden transition-transform duration-150 ease-out active:scale-[0.995]"
                      style={{ backgroundColor: frame.color }}
                    >
                      <Image
                        src={frame.src}
                        alt=""
                        fill
                        sizes="(min-width: 640px) 33vw, 50vw"
                        // The top row, eagerly — and that is the first side
                        // of each of the first three releases, not the first
                        // three frames: a sleeve's second side sits in the
                        // row below its first, so counting along the flat
                        // sequence prioritises a cover that is off screen and
                        // lazy-loads the one that is the LCP.
                        priority={r < 3 && side === 0}
                        className="object-cover transition-opacity duration-300 ease-out hoverable:group-hover:opacity-70 motion-reduce:transition-none"
                      />
                    </button>
                  );
                })}
              </div>

              {/* The release, named on hover or on focus. A rack of covers is
                  scanned for a name you recognise, and on a sleeve it is also
                  what says the two halves are one record. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-background/90 to-transparent p-4 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none">
                <span className="label text-foreground">{release.title}</span>
                <span className="label text-muted-foreground">{release.artist}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <Lightbox frames={frames} name="Cover art" {...lightbox} />
    </>
  );
}
