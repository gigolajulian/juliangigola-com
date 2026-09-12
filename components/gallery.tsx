"use client";

import * as React from "react";
import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { Lightbox, useLightbox } from "@/components/lightbox";
import { cn } from "@/lib/utils";
import type { Project, TextBlock } from "@/lib/work-types";

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

  /**
   * Writing, grouped by the number of frames that precede it.
   *
   * Keyed by count rather than looked up per row so a run of blocks between
   * the same two photographs stays in the order it was written, and so the
   * lookup below is one map read instead of a filter across every row.
   */
  const blocks = React.useMemo(() => {
    const byPosition = new Map<number, TextBlock[]>();
    for (const b of project.blocks ?? []) {
      byPosition.set(b.after, [...(byPosition.get(b.after) ?? []), b]);
    }
    return byPosition;
  }, [project.blocks]);

  /* How many frames have been laid out once each row is done, so a block
     saved as "after 4 frames" lands under the row holding the fourth. Rows
     are one or two wide, so this is not the row index. */
  let laid = 0;

  return (
    <>
      <div className="mt-16 flex flex-col gap-4 sm:mt-24 sm:gap-6">
        {/* Anything positioned at nothing opens the sequence. */}
        <Passages blocks={blocks.get(0)} />

        {rows.map((row, r) => {
          laid += row.length;
          const after = blocks.get(laid);
          return (
            <React.Fragment key={r}>
              <div
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
                        className="group relative block w-full cursor-zoom-in overflow-hidden press active:scale-[0.995]"
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
                          sizes={
                            row.length === 2
                              ? "(min-width: 640px) 50vw, 100vw"
                              : "100vw"
                          }
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
              <Passages blocks={after} />
            </React.Fragment>
          );
        })}
      </div>

      <Lightbox frames={frames} name={project.name} {...lightbox} />
    </>
  );
}

/**
 * A passage between the photographs.
 *
 * Set narrow and centred rather than to the width of the frames. The gallery
 * runs to 100rem because a photograph earns the room; a line of text that
 * wide is unreadable, and `max-w-prose` is the same measure the project's
 * intent copy already uses — so writing added here sits at the width the rest
 * of the page's prose does instead of announcing itself as a different thing.
 */
function Passages({ blocks }: { blocks?: TextBlock[] }) {
  if (!blocks?.length) return null;

  return (
    <>
      {blocks.map((block, i) => (
        <Reveal key={`${block.after}-${i}`}>
          <div className="mx-auto w-full max-w-[100rem] px-6 py-8 sm:px-10 sm:py-16">
            <div className="mx-auto max-w-prose">
              {block.heading ? (
                <h2 className="font-display text-2xl uppercase tracking-[0.02em]">
                  {block.heading}
                </h2>
              ) : null}
              {/* Blank lines are paragraph breaks. A textarea is what the
                  editor gives Julian, so the newlines he types there are the
                  only structure available — and turning them into real
                  paragraphs costs a split. */}
              {block.body.split(/\n{2,}/).map((para, p) => (
                <p
                  key={p}
                  className={cn(
                    "text-base leading-relaxed text-muted-foreground",
                    p === 0 && block.heading ? "mt-6" : p === 0 ? "" : "mt-5",
                  )}
                >
                  {para}
                </p>
              ))}
            </div>
          </div>
        </Reveal>
      ))}
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
