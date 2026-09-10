"use client";

import * as React from "react";
import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { Lightbox, useLightbox } from "@/components/lightbox";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/work-types";

/* ── the sequence ─────────────────────────────────────────────────
 * A project's frames, in the order Julian sequenced them, at a size worth
 * looking at.
 *
 * The old site showed everything as a uniform grid of small thumbnails,
 * which flattens a sequence into an inventory. Here the layout follows the
 * frames instead: a landscape frame takes the full width, portraits pair up.
 * That is how a picture editor lays out a spread, and it means the shape of
 * the page is decided by the photographs rather than imposed on them.
 * ─────────────────────────────────────────────────────────────── */

export function Gallery({ project }: { project: Project }) {
  const frames = project.images;
  const lightbox = useLightbox(frames.length);

  // Rows of one or two, decided by each frame's own shape.
  const rows = React.useMemo(() => pair(frames), [frames]);

  return (
    <>
      <div className="mt-16 flex flex-col gap-4 sm:mt-24 sm:gap-6">
        {rows.map((row, r) => (
          <div
            key={r}
            className={cn(
              "mx-auto grid w-full max-w-[100rem] gap-4 px-6 sm:gap-6 sm:px-10",
              row.length === 2 ? "sm:grid-cols-2" : "grid-cols-1",
            )}
          >
            {row.map((frame) => {
              const i = frames.indexOf(frame);
              return (
                // Short, staggered delays inside a row so a pair arrives as
                // one gesture rather than two separate events.
                <Reveal key={frame.src} delay={(i % 2) * 60}>
                  <button
                    type="button"
                    onClick={() => lightbox.show(i)}
                    aria-label={`Open frame ${i + 1} of ${frames.length}${
                      frame.alt ? `: ${frame.alt}` : ""
                    }`}
                    className="group relative block w-full cursor-zoom-in overflow-hidden transition-transform duration-150 ease-out active:scale-[0.995]"
                    style={{
                      backgroundColor: frame.color,
                      aspectRatio: `${frame.width} / ${frame.height}`,
                    }}
                  >
                    <Image
                      src={frame.src}
                      alt={frame.alt || `${project.name} — frame ${i + 1}`}
                      width={frame.width}
                      height={frame.height}
                      sizes={row.length === 2 ? "(min-width: 640px) 50vw, 100vw" : "100vw"}
                      // The first two frames are the ones above the fold on
                      // nearly every screen; everything after loads lazily.
                      priority={i < 2}
                      className="h-full w-full object-cover"
                    />
                  </button>
                </Reveal>
              );
            })}
          </div>
        ))}
      </div>

      <Lightbox frames={frames} name={project.name} {...lightbox} />
    </>
  );
}

/**
 * Groups frames into rows: a landscape frame stands alone at full width, and
 * consecutive frames that are not landscape pair off.
 *
 * Squares pair as well as portraits. A square at full width is a picture as
 * tall as the viewport is wide, which turns a run of them into a scroll with
 * one frame per screen. Cover art has its own layout entirely; this is what
 * keeps the odd square inside a photographic sequence in proportion with the
 * portraits around it.
 *
 * Sequence is preserved exactly — this only decides where the line breaks
 * are, never the order.
 */
function pair<T extends { width: number; height: number }>(frames: T[]): T[][] {
  const twoUp = (f: { width: number; height: number }) => f.height >= f.width;
  const rows: T[][] = [];

  for (const frame of frames) {
    const last = rows[rows.length - 1];
    const canJoin = twoUp(frame) && last?.length === 1 && twoUp(last[0]);

    if (canJoin) last.push(frame);
    else rows.push([frame]);
  }

  return rows;
}
