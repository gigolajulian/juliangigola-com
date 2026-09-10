"use client";

import * as React from "react";
import Image from "next/image";
import { Dialog, VisuallyHidden } from "radix-ui";
import { Reveal } from "@/components/reveal";
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
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const frames = project.images;

  // Radix returns focus to its own `Dialog.Trigger`, and there isn't one here
  // — the lightbox is opened from whichever of eighteen frames was clicked.
  // Without this, closing drops focus on <body> and a keyboard visitor has to
  // tab from the top of the page again to get back to where they were.
  const opener = React.useRef<HTMLElement | null>(null);

  const show = (i: number) => {
    opener.current = document.activeElement as HTMLElement | null;
    setIndex(i);
    setOpen(true);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) opener.current?.focus();
  };

  const step = React.useCallback(
    (delta: number) => setIndex((i) => (i + delta + frames.length) % frames.length),
    [frames.length],
  );

  // Arrow keys page through the sequence. Radix handles Escape and the focus
  // trap; focus restoration is `onOpenChange` above.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  // Rows of one or two, decided by each frame's own shape.
  const rows = React.useMemo(() => pair(frames), [frames]);
  const current = frames[index];

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
                    onClick={() => show(i)}
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

      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-background/95 animate-in fade-in duration-200 ease-out motion-reduce:animate-none" />

          <Dialog.Content
            className={cn(
              "fixed inset-0 z-50 flex flex-col outline-none",
              // Modals keep a centred origin — they are not anchored to a
              // trigger, so scaling from one would look arbitrary.
              "animate-in fade-in zoom-in-[0.98] duration-200 ease-out motion-reduce:animate-none",
            )}
          >
            <VisuallyHidden.Root>
              <Dialog.Title>{`${project.name} — frame ${index + 1} of ${frames.length}`}</Dialog.Title>
            </VisuallyHidden.Root>

            <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10">
              {current ? (
                <Image
                  key={current.src}
                  src={current.src}
                  alt={current.alt || `${project.name} — frame ${index + 1}`}
                  width={current.width}
                  height={current.height}
                  sizes="100vw"
                  priority
                  className="max-h-full w-auto max-w-full object-contain"
                />
              ) : null}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-6 px-6 pb-6 sm:px-10 sm:pb-8">
              <p className="label text-muted-foreground">
                {index + 1} / {frames.length}
              </p>

              <div className="flex items-center gap-2">
                <LightboxButton onClick={() => step(-1)} label="Previous frame">
                  &larr;
                </LightboxButton>
                <LightboxButton onClick={() => step(1)} label="Next frame">
                  &rarr;
                </LightboxButton>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="label ml-4 px-3 py-2 text-muted-foreground transition-[color,transform] duration-150 ease-out hoverable:hover:text-foreground active:scale-[0.97]"
                  >
                    Close
                  </button>
                </Dialog.Close>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

function LightboxButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      // 44px minimum target — this is the control someone taps repeatedly on
      // a phone, so it gets a real hit area rather than an icon's worth.
      className="flex h-11 w-11 items-center justify-center border border-border text-base transition-[background-color,transform] duration-150 ease-out hoverable:hover:bg-card active:scale-[0.97]"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}

/**
 * Groups frames into rows: a landscape frame stands alone at full width, and
 * consecutive portraits pair off.
 *
 * Sequence is preserved exactly — this only decides where the line breaks
 * are, never the order.
 */
function pair<T extends { width: number; height: number }>(frames: T[]): T[][] {
  const rows: T[][] = [];

  for (const frame of frames) {
    const isPortrait = frame.height > frame.width;
    const last = rows[rows.length - 1];

    const canJoin =
      isPortrait &&
      last?.length === 1 &&
      last[0].height > last[0].width;

    if (canJoin) last.push(frame);
    else rows.push([frame]);
  }

  return rows;
}
