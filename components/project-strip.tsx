"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ViewTransition } from "react";
import { Lightbox, useLightbox } from "@/components/lightbox";
import { Strip, type Lead } from "@/components/strip";
import type { Project, TextBlock, Frame } from "@/lib/work-types";

/* ── the sequence, across the screen ──────────────────────────────
 * A project is one screen and the frames run across it, all at the same
 * height, in the order Julian sequenced them. Julian asked for the project
 * pages to work like remyshoots.co.za: a filmstrip with the title over it
 * and a thin instrument panel under it.
 *
 * Why this suits the work better than the spread it replaces: a sequence is
 * a sequence. Down a page, two frames sit side by side because they happen
 * to be portraits and the next pair is a screen away; across a strip every
 * frame is the same height, the one before and the one after are both in
 * view, and the shape of each photograph is the only thing that varies. It
 * is a contact sheet at a size worth looking at.
 *
 * The moving is `strip.tsx`, the same machine every horizontal page on the
 * site runs on. This file is only what a project puts in it: the opening
 * plate with the title and credits, the frames, the writing between them
 * where it was written, and the name of the project that follows.
 *
 * The sequence ends on the next project, not on nothing: its name is the
 * last cell of the strip, and a wheel that keeps turning once the strip
 * has run out goes there. Julian's reference for the whole page is
 * remyshoots.co.za, where this is how one project leads to the next.
 * ─────────────────────────────────────────────────────────────── */

type Cell =
  | { kind: "title" }
  | { kind: "frame"; frame: Frame; n: number }
  | { kind: "text"; block: TextBlock }
  | { kind: "next" };

/** The morph's landing side. The index covers and the homepage tiles carry
    `cover-<slug>`; the frame that answers to it is the first one here, so
    the picture travels rather than the page cutting to it. Without a slug
    it is nothing at all, which is what every other frame wants. */
function Frame({
  slug,
  children,
}: {
  slug?: string;
  children: React.ReactNode;
}) {
  if (!slug) return children;
  return (
    <ViewTransition name={`cover-${slug}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}

/** The name it had before the machine was lifted out; pages still use it. */
export type NextUp = Lead;

export function ProjectStrip({
  project,
  next,
  prev,
  className,
}: {
  project: Project;
  /** What the strip ends on and where a wheel past the end goes. */
  next?: NextUp;
  /** Where a wheel past the start goes. Julian asked for the way back too. */
  prev?: NextUp;
  className?: string;
}) {
  const frames = project.images;
  const scroller = React.useRef<HTMLDivElement>(null);
  const lightbox = useLightbox(frames);

  /* The photographs with the writing back in its place. `lib/work.ts` pulls
     the two apart — the lightbox and the counts have no use for a paragraph
     — and a strip is the one place that wants them interleaved again, each
     block a cell of its own where it was written. */
  const cells = React.useMemo<Cell[]>(() => {
    const byPosition = new Map<number, TextBlock[]>();
    for (const b of project.blocks ?? []) {
      byPosition.set(b.after, [...(byPosition.get(b.after) ?? []), b]);
    }
    /* The sequence opens on the title. Julian asked for the title in large
       bold with the credits right before the first image, which is also
       where a printed portfolio puts them: the plate before the plates. */
    const out: Cell[] = [{ kind: "title" }];
    frames.forEach((frame, i) => {
      for (const block of byPosition.get(i) ?? [])
        out.push({ kind: "text", block });
      out.push({ kind: "frame", frame, n: i });
    });
    for (const block of byPosition.get(frames.length) ?? []) {
      out.push({ kind: "text", block });
    }
    if (next) out.push({ kind: "next" });
    return out;
  }, [frames, project.blocks, next]);

  // The number under the strip counts photographs, so a paragraph between
  // two of them holds the count of the frame it was written after: the last
  // frame at or before the cell in the middle of the window.
  const counter = React.useCallback(
    (at: number) => {
      let shown = 1;
      for (let i = Math.min(at, cells.length - 1); i >= 0; i--) {
        const cell = cells[i];
        if (cell?.kind === "frame") {
          shown = cell.n + 1;
          break;
        }
      }
      return (
        <p className="label shrink-0 tabular-nums text-muted-foreground">
          <span className="text-foreground">
            {String(shown).padStart(2, "0")}
          </span>
          {" / "}
          {String(frames.length).padStart(2, "0")}
        </p>
      );
    },
    [cells, frames.length],
  );

  /* Built once per project, not once per scroll. The counter and the ticks
     change cell many times across a drag, and each change is a render of
     the strip's panel; handed the same elements again React skips the
     photographs and re-renders only the panel. A re-render of the whole
     strip at each cell boundary is a frame dropped exactly where the eye is
     moving from one picture to the next. */
  const cellNodes = React.useMemo(
    () =>
      cells.map((cell) =>
        cell.kind === "title" ? (
          /* The opening plate: the name of the work, large, with whoever
                 made it under it. These used to be a row of small capitals
                 under the sequence; they open it instead, which is what
                 Julian asked for and which hands the page back most of the
                 height that showing the footer costs.

                 Four of the seventy-three projects carry credits, so this is
                 usually a title alone. That is the point of putting it
                 somewhere worth filling in: they are added in /admin. */
          <div
            key="title"
            className="flex h-full w-[min(30rem,82vw)] shrink-0 flex-col justify-center gap-5 pr-2 max-sm:w-[68vw] sm:pr-6"
          >
            {/* Each word rises into place from under a clip, one after
                    another, and the credits follow it up. Julian asked for
                    the title to animate as a project opens. The clip is on
                    the word, not the line, so the words can wrap. */}
            <h2
              aria-hidden
              className="font-display text-4xl uppercase leading-[0.95] tracking-[0] sm:text-6xl"
            >
              {(project.headline ?? project.name).split(" ").map((word, i) => (
                <React.Fragment key={i}>
                  <span className="inline-block overflow-hidden align-top">
                    <span
                      className="title-word inline-block"
                      style={{ "--i": i } as React.CSSProperties}
                    >
                      {word}
                    </span>
                  </span>{" "}
                </React.Fragment>
              ))}
            </h2>

            {/* The writing about the work, when there is any. It used to
                    sit in the page header, where on a page that cannot
                    scroll a paragraph would have squeezed the photographs.
                    Skipped when it is the title again, or a leftover credit
                    line ("styling: @handle") which the credits below say
                    properly. Either can be rewritten in /admin. */}
            {project.intent &&
            !project.intent.includes("@") &&
            project.intent.trim().toLowerCase() !==
              project.name.trim().toLowerCase() ? (
              <p className="title-rest max-w-prose text-sm leading-relaxed text-muted-foreground">
                {project.intent}
              </p>
            ) : null}

            {project.credits.length ? (
              <dl
                aria-label="Credits"
                className="title-rest flex flex-col gap-1 border-t border-border pt-4"
              >
                {project.credits.map((credit, i) => {
                  /* Six harvested credits carry the handle as the name
                         ("@apricotsss3") with no instagram field; they link
                         too. */
                  const handle =
                    credit.instagram ??
                    (credit.name.startsWith("@") ? credit.name.slice(1) : null);
                  return (
                    <div
                      key={`${credit.role}-${i}`}
                      className="flex items-baseline gap-3"
                    >
                      <dt className="label w-28 shrink-0 text-muted-foreground/70">
                        {credit.role}
                      </dt>
                      <dd className="label min-w-0">
                        {handle ? (
                          /* A new tab on purpose: the visitor is on a
                                 project, and taking the page out from under
                                 them to show someone else's feed would lose
                                 their place. */
                          <a
                            href={`https://www.instagram.com/${handle}/`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
                          >
                            {credit.name}
                            <span className="sr-only">
                              {" "}
                              on Instagram (opens in a new tab)
                            </span>
                          </a>
                        ) : (
                          credit.name
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : null}
          </div>
        ) : cell.kind === "next" ? (
          /* The last cell: where the sequence goes next, written and
                 not shown. It carried the next project's cover for a day
                 and Julian said the image from the next page was showing
                 up on this one — which is also how the reference has it:
                 the sequence ends, and past the last photograph there is
                 the name of what follows on empty ground. The pictures on
                 a project page are that project's. */
          <Link
            key="next"
            href={next!.href}
            data-ring="Next project"
            className="flex h-full shrink-0 flex-col justify-center gap-2 pl-10 pr-6 sm:pl-24 sm:pr-10"
          >
            <span className="label text-muted-foreground">Next project</span>
            <span className="font-display text-2xl uppercase leading-none tracking-[0] transition-opacity duration-200 hoverable:hover:opacity-70 sm:text-4xl">
              {next!.name}
            </span>
            {next!.client ? (
              <span className="label text-muted-foreground">
                {next!.client}
              </span>
            ) : null}
          </Link>
        ) : cell.kind === "text" ? (
          <div
            key={`text-${cell.block.after}-${cell.block.heading ?? ""}`}
            data-tick
            className="flex h-full w-[min(24rem,80vw)] shrink-0 flex-col justify-center"
          >
            {cell.block.heading ? (
              <h2 className="font-display text-xl uppercase leading-none tracking-[0]">
                {cell.block.heading}
              </h2>
            ) : null}
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {cell.block.body}
            </p>
          </div>
        ) : (
          /* Full height, and as wide as that height makes it: the
                 photograph's own shape is the only thing that decides how
                 much of the strip it takes. */
          <button
            key={cell.frame.src}
            data-tick
            data-ring="Zoom in"
            type="button"
            // Opened by the strip's delegated listener, which is where
            // the lightbox is reached through a ref.
            data-n={cell.n}
            aria-label={`Open frame ${cell.n + 1} of ${frames.length}${
              cell.frame.alt ? `: ${cell.frame.alt}` : ""
            }`}
            className="group strip-cell relative h-full shrink-0 overflow-hidden press active:scale-[0.995]"
            style={
              {
                backgroundColor: cell.frame.color,
                aspectRatio: `${cell.frame.width} / ${cell.frame.height}`,
                // Its place in the order, for the stagger of the arrival
                // (`strip-cell` in `globals.css`). The pictures are all
                // fetched at once as before; only the reveal is in turn.
                "--i": cell.n,
              } as React.CSSProperties
            }
          >
            <Frame
              // The first frame is the picture the index was showing:
              // named, it morphs out of the cover that was clicked
              // instead of the page cutting. Every other frame is a
              // plain image, one element per name per page.
              slug={cell.n === 0 ? project.slug : undefined}
            >
              <Image
                // How the lightbox finds the frame to lift out of the
                // strip, and to land back in. See `lightbox.tsx`.
                data-frame={cell.frame.src}
                src={cell.frame.src}
                alt={cell.frame.alt || `${project.name}, frame ${cell.n + 1}`}
                fill
                // A frame is as tall as the strip and as wide as its ratio
                // says, not as wide as the window. Measured: a portrait
                // frame on a phone is 524css wide and was fetched at 1080
                // for 1376 needed; on a laptop it is 490 wide and fetched
                // 1080 for 490. 8rem is the bar and the ruler. A 3x phone
                // is told two thirds of the truth, so it fetches about 2x:
                // full density there was 6.5MB of frames on one page, and
                // the difference past 2x is not one a phone shows.
                sizes={`(min-resolution: 2.5dppx) calc((100vh - 8rem) * ${((cell.frame.width / cell.frame.height) * 0.667).toFixed(3)}), calc((100vh - 8rem) * ${(cell.frame.width / cell.frame.height).toFixed(3)})`}
                // The first two lead the page's loading; every other frame
                // is fetched at once rather than as the strip reaches it.
                // Left lazy, Julian's recording showed each frame arriving
                // as a block of colour and filling in under the wheel,
                // and the swap from block to picture read as a snap
                // between every image. The page is the sequence; the
                // sequence has to be there.
                priority={cell.n < 2}
                loading="eager"
                placeholder={
                  cell.n === 0 && project.cover.blur ? "blur" : "empty"
                }
                blurDataURL={cell.n === 0 ? project.cover.blur : undefined}
                draggable={false}
                className="strip-frame h-full w-full object-cover"
              />
            </Frame>
          </button>
        ),
      ),
    [
      cells,
      frames.length,
      project.name,
      project.headline,
      project.intent,
      project.credits,
      project.cover.blur,
      project.slug,
      next,
    ],
  );

  return (
    <>
      <Strip
        ref={scroller}
        label={`${project.name}: ${frames.length} frames, left and right`}
        next={next}
        prev={prev}
        // Sideways on a phone too: a sequence swipes.
        stack={false}
        onOpen={lightbox.show}
        counter={counter}
        className={className}
      >
        {cellNodes}
      </Strip>

      <Lightbox frames={frames} name={project.name} {...lightbox} />
    </>
  );
}
