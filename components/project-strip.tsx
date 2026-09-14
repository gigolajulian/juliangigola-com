"use client";

import * as React from "react";
import Image from "next/image";
import { PointerRing } from "@/components/pointer-ring";
import { Lightbox, useLightbox } from "@/components/lightbox";
import { cn } from "@/lib/utils";
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
 * Native scrolling, not a transform driven by pointer events. It costs
 * nothing to a keyboard (arrow keys and Home/End land for free), a
 * touchscreen swipes it, and a trackpad's own horizontal gesture works
 * without being interpreted. The one thing added is the mouse wheel: a
 * vertical wheel moves the strip sideways until it runs out, and then the
 * page has it back — the same handover the work index uses, which is the
 * behaviour Julian asked for there.
 * ─────────────────────────────────────────────────────────────── */

type Cell =
  | { kind: "frame"; frame: Frame; n: number }
  | { kind: "text"; block: TextBlock };

export function ProjectStrip({
  project,
  className,
}: {
  project: Project;
  className?: string;
}) {
  const frames = project.images;
  const lightbox = useLightbox(frames);
  const scroller = React.useRef<HTMLDivElement>(null);
  const [at, setAt] = React.useState(0);

  /* The photographs with the writing back in its place. `lib/work.ts` pulls
     the two apart — the lightbox and the counts have no use for a paragraph
     — and a strip is the one place that wants them interleaved again, each
     block a cell of its own where it was written. */
  const cells = React.useMemo<Cell[]>(() => {
    const byPosition = new Map<number, TextBlock[]>();
    for (const b of project.blocks ?? []) {
      byPosition.set(b.after, [...(byPosition.get(b.after) ?? []), b]);
    }
    const out: Cell[] = [];
    frames.forEach((frame, i) => {
      for (const block of byPosition.get(i) ?? []) out.push({ kind: "text", block });
      out.push({ kind: "frame", frame, n: i });
    });
    for (const block of byPosition.get(frames.length) ?? []) {
      out.push({ kind: "text", block });
    }
    return out;
  }, [frames, project.blocks]);

  /* Which cell is nearest the middle of the window. Read off the scroll
     position rather than with an observer, because the counter and the
     ruler want it every frame of a drag and not on a threshold. */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let queued = 0;
    const read = () => {
      queued = 0;
      const room = el.scrollWidth - el.clientWidth;
      /* Either end is that end's cell, whatever is nearest the middle.
         At the far end the last frame is often narrower than half a window,
         so the middle of the window sits over the one before it and the
         counter could never reach the last frame at all. */
      if (el.scrollLeft >= room - 2) {
        setAt(el.children.length - 1);
        return;
      }
      if (el.scrollLeft <= 2) {
        setAt(0);
        return;
      }
      const middle = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let nearest = Infinity;
      Array.from(el.children).forEach((child, i) => {
        const cell = child as HTMLElement;
        const gap = Math.abs(cell.offsetLeft + cell.offsetWidth / 2 - middle);
        if (gap < nearest) {
          nearest = gap;
          best = i;
        }
      });
      setAt(best);
    };
    const onScroll = () => {
      if (!queued) queued = requestAnimationFrame(read);
    };
    read();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", read);
      if (queued) cancelAnimationFrame(queued);
    };
  }, [cells.length]);

  /* A vertical wheel moves the strip sideways, and stops doing so at either
     end so the page can carry on to the enquiry below. `passive: false`
     because it has to be able to take the event; left passive, the browser
     would scroll the page at the same time and both would move. */
  React.useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // A pinch is a zoom, and a trackpad's sideways swipe already works.
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const room = el.scrollWidth - el.clientWidth;
      const ended = e.deltaY > 0 ? el.scrollLeft >= room - 1 : el.scrollLeft <= 0;
      if (ended) return;
      e.preventDefault();
      el.scrollLeft = Math.min(room, Math.max(0, el.scrollLeft + e.deltaY));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  /** Puts a cell in the middle of the window. */
  const goTo = (i: number) => {
    const el = scroller.current;
    const cell = el?.children[i] as HTMLElement | undefined;
    if (!el || !cell) return;
    el.scrollTo({
      left: cell.offsetLeft - (el.clientWidth - cell.offsetWidth) / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  };

  // The number under the strip counts photographs, so a paragraph between
  // two of them holds the count of the frame it was written after: the last
  // frame at or before the cell in the middle of the window.
  const shown = React.useMemo(() => {
    for (let i = Math.min(at, cells.length - 1); i >= 0; i--) {
      const cell = cells[i];
      if (cell?.kind === "frame") return cell.n + 1;
    }
    return 1;
  }, [at, cells]);

  return (
    <>
      <div className={cn("flex min-h-0 flex-col", className)}>
        <div
          ref={scroller}
          tabIndex={0}
          aria-label={`${project.name}: ${frames.length} frames, left and right`}
          /* `snap-proximity`, not mandatory: the wheel handler above writes
             `scrollLeft` directly, and a mandatory snap fights a scroll it
             did not start. Proximity lets a flick settle on a frame without
             dragging every movement to the nearest one. */
          className={cn(
            "flex min-h-0 flex-1 snap-x snap-proximity items-center gap-3 overflow-x-auto overflow-y-hidden sm:gap-4",
            "px-6 sm:px-10",
            "strip-scroll focus-visible:outline-none",
          )}
        >
          {cells.map((cell) =>
            cell.kind === "text" ? (
              <div
                key={`text-${cell.block.after}-${cell.block.heading ?? ""}`}
                className="flex h-full w-[min(24rem,80vw)] shrink-0 snap-center flex-col justify-center"
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
                data-ring
                type="button"
                onClick={() => lightbox.show(cell.n)}
                aria-label={`Open frame ${cell.n + 1} of ${frames.length}${
                  cell.frame.alt ? `: ${cell.frame.alt}` : ""
                }`}
                className="group relative h-full shrink-0 snap-center overflow-hidden press hoverable:cursor-none active:scale-[0.995]"
                style={{
                  backgroundColor: cell.frame.color,
                  aspectRatio: `${cell.frame.width} / ${cell.frame.height}`,
                }}
              >
                <Image
                  src={cell.frame.src}
                  alt={cell.frame.alt || `${project.name}, frame ${cell.n + 1}`}
                  fill
                  sizes="(min-width: 1024px) 60vw, 90vw"
                  // The first two are on screen at once on nearly every
                  // window; the rest arrive as the strip reaches them.
                  priority={cell.n < 2}
                  placeholder={
                    cell.n === 0 && project.cover.blur ? "blur" : "empty"
                  }
                  blurDataURL={cell.n === 0 ? project.cover.blur : undefined}
                  className="h-full w-full object-cover"
                />
              </button>
            ),
          )}
        </div>

        {/* The panel: a tick for every cell, the one you are on inked and
            tall, and the count beside it. Each tick is a control — the strip
            is long and a visitor who wants the last frame should not have to
            travel the whole sequence to reach it. */}
        <div className="mt-4 flex items-end gap-6 px-6 sm:px-10">
          <p className="label shrink-0 tabular-nums text-muted-foreground">
            <span className="text-foreground">
              {String(shown).padStart(2, "0")}
            </span>
            {" / "}
            {String(frames.length).padStart(2, "0")}
          </p>

          <div
            aria-hidden
            className="flex min-w-0 flex-1 items-end justify-between gap-px"
          >
            {cells.map((cell, i) => (
              <button
                key={`tick-${i}`}
                type="button"
                tabIndex={-1}
                onClick={() => goTo(i)}
                className="group flex h-4 flex-1 items-end"
              >
                <span
                  className={cn(
                    "block w-full rounded-full transition-[height,background-color] duration-200 ease-[var(--ease-out-strong)]",
                    i === at
                      ? "h-4 bg-foreground"
                      : "h-1.5 bg-foreground/20 hoverable:group-hover:bg-foreground/50",
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <PointerRing />
      <Lightbox frames={frames} name={project.name} {...lightbox} />
    </>
  );
}
