"use client";

import * as React from "react";
import Image from "next/image";
import { Lightbox, useLightbox } from "@/components/lightbox";
import { COVER_PRESS } from "@/components/v3/mt/data";
import { sleeveTilt } from "@/components/v3/mt/motion/sleeve-tilt";
import "@/components/v3/mt/motion/rows.css";
import { CoverFaces, coverLabel } from "@/components/cover/cover-faces";
import type { CoverRelease } from "@/lib/cover-art-types";
import { cn } from "@/lib/utils";

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

export function CoverArtGallery({
  releases,
  rows = false,
  v4 = false,
}: {
  releases: CoverRelease[];
  /** One row of sleeves running along a strip, each the strip's full
      height, instead of three columns down a page. On a phone, two
      columns. Julian: the whole height, with a gap between the sleeves
      smaller than the strip's own. */
  rows?: boolean;
  /** The Cover art page under `?v4pages` (c1): each cell is the V4 home's
      sleeve (`.mt-sleeve`, mtscroll.css), three across at every size. On a
      fine pointer the cover lifts and its record slides out. A click opens
      side A; the back is in the viewer. */
  v4?: boolean;
}) {
  const list = React.useRef<HTMLUListElement>(null);
  React.useEffect(() => {
    if (!v4) return;
    const ac = new AbortController();
    const fine = matchMedia("(hover:hover) and (pointer:fine)"), calm = matchMedia("(prefers-reduced-motion: reduce)");
    list.current?.querySelectorAll<HTMLElement>(".mt-sleeve").forEach((it) => sleeveTilt(it, () => fine.matches && !calm.matches, { signal: ac.signal }));
    return () => ac.abort();
  }, [v4]);

  // The lightbox pages through every side in order, so arrowing off side A
  // lands on side B rather than skipping to the next release.
  const frames = React.useMemo(
    () => releases.flatMap((r) => r.frames),
    [releases],
  );
  const lightbox = useLightbox(frames);

  // A cell opens at its own position in that flat sequence. Keyed by `src`,
  // which is unique per side.
  const positions = React.useMemo(
    () => new Map(frames.map((f, i) => [f.src, i])),
    [frames],
  );

  return (
    <>
      <ul
        ref={list}
        data-ring="Zoom"
        // Two rows deep in the rack (grid view), one in the strip.
        data-rack={rows || undefined}
        className={cn(
          !v4 && "grid",
          v4
            ? "cv4"
            : rows
            ? "h-full grid-flow-col grid-rows-1 gap-2 max-sm:h-auto max-sm:grid-flow-row max-sm:grid-cols-2"
            : "mt-12 grid-cols-2 sm:mt-16 sm:grid-cols-3",
        )}
      >
        {releases.map((release, i) => {
          const front = release.frames[0];
          if (!front) return null;

          const name = (
            <>
              {/* The release, named on hover or on focus. A rack of covers
                    is scanned for a name you recognise. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 glass-surface bg-background/70 p-4 opacity-0 transition-opacity duration-200 ease-out hoverable:settled:group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                <span className="label text-foreground">{release.title}</span>
                <span className="label text-muted-foreground">
                  {release.artist}
                </span>
              </div>
            </>
          );

          const cell = v4 ? (
            <button
              type="button"
              onClick={(e) => lightbox.show(positions.get(front.src) ?? 0, e.currentTarget.querySelector<HTMLElement>("img"))}
              aria-label={`Open ${coverLabel(release.title, release.artist, release.frames)}`}
              data-vt={front.src}
              data-ring="Zoom"
              className="group mt-sleeve"
              // The pressing: the home's color where it names one, the cover's own otherwise.
              style={{ "--press": COVER_PRESS[release.slug] ?? front.color } as React.CSSProperties}
            >
              <span className="disc" aria-hidden />
              <span className="face">
                <Image data-frame={front.src} src={front.src} alt={front.alt} fill sizes="34vw" priority={i < 3} style={{ background: front.color }} />
              </span>
              {/* Named the way the home names its covers: a mono caption under the sleeve, no band over the art. */}
              <span className="cv4c" aria-hidden><span>{release.title}</span><span className="mute">{release.artist}</span></span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                // Open whichever side is on screen. `:hover` is the same
                // thing the crossfade is keyed on, so the lightbox shows the
                // cover that was actually clicked — and a keyboard Enter,
                // where nothing is hovered, opens side A.
                const turned =
                  release.frames.length > 1 &&
                  e.currentTarget.matches(":hover");
                const frame = release.frames[turned ? 1 : 0];
                // The sleeve itself is the picture's origin: the side that
                // opens may not be the side on the page, so it cannot be
                // found by source.
                lightbox.show(
                  positions.get(frame.src) ?? 0,
                  // The side that is actually face up. Both are mounted and
                  // the hover crossfades between them, so handing over the
                  // first of the two would hand over an element at zero
                  // opacity: the picture then flew home to something
                  // invisible, and on the way out there was nothing on
                  // screen at all.
                  e.currentTarget.querySelector<HTMLElement>(
                    `img[data-frame="${CSS.escape(frame.src)}"]`,
                  ),
                );
              }}
              aria-label={`Open ${coverLabel(release.title, release.artist, release.frames)}`}
              // Flies between the views as the covers do (`morphView`).
              data-vt={front.src}
              data-ring="Zoom"
              className={cn(
                "group relative block aspect-square w-full overflow-hidden press active:scale-[0.995]",
                rows && "sm:h-full sm:w-auto",
              )}
              style={{ backgroundColor: front.color }}
            >
              <CoverFaces
                frames={release.frames}
                sizes={
                  rows ? "(min-width: 640px) calc(100vh - 10rem), 50vw" : "(min-width: 640px) 33vw, 50vw"
                }
                // The top row, eagerly — it is the largest thing above the
                // fold. The rest of the rack loads as it is reached.
                priority={i < 3}
              />

              {name}
            </button>
          );

          return (
            <li key={release.slug} className={rows ? "sm:min-h-0" : undefined}>
              {cell}
            </li>
          );
        })}
      </ul>

      <Lightbox frames={frames} name="Cover Art" {...lightbox} />
    </>
  );
}
