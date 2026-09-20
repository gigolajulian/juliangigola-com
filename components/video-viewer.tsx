"use client";

import * as React from "react";
import Image from "next/image";
import { Dialog, VisuallyHidden } from "radix-ui";
import { cn } from "@/lib/utils";
import { embedUrl, posterFor, type Video } from "@/lib/videos";

/* ── the viewer ───────────────────────────────────────────────────
 * A film opens here rather than playing in its tile, at Julian's ask:
 * the player at 70% of the screen, and the other films in a row under
 * it so the next one is a click away without closing anything. Click
 * a poster in the row and the player switches to it; the arrow keys do
 * the same; Escape, the Close button, or a click on the ground closes.
 *
 * Radix handles the focus trap, Escape and the scroll lock. The iframe
 * is keyed on the film so switching cannot hand the new film the old
 * player and leave two playing.
 * ─────────────────────────────────────────────────────────────── */

export function VideoViewer({
  videos,
  current,
  onChange,
}: {
  /** Every film the row can offer, in page order. */
  videos: Video[];
  /** The film playing, or null while closed. */
  current: Video | null;
  onChange: (next: Video | null) => void;
}) {
  const at = current ? videos.findIndex((v) => v.id === current.id) : -1;
  const step = React.useCallback(
    (d: number) => {
      if (at === -1 || videos.length < 2) return;
      onChange(videos[(at + d + videos.length) % videos.length]);
    },
    [at, videos, onChange],
  );

  React.useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, step]);

  const close = () => onChange(null);
  const others = videos.filter((v) => v.id !== current?.id);

  return (
    <Dialog.Root open={current !== null} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/95 animate-in fade-in duration-200 ease-out motion-reduce:animate-none" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col outline-none animate-in fade-in duration-200 ease-out motion-reduce:animate-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>{current?.title ?? "Video"}</Dialog.Title>
          </VisuallyHidden.Root>

          {/* Anywhere that is not the player or the row closes it. The
              check is against the element itself, so the player and the
              posters keep their own jobs. */}
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 pt-6 sm:px-10"
          >
            {current ? (
              <div className="w-[min(70vw,calc((100dvh-16rem)*16/9))] max-w-full">
                <div className="relative aspect-video w-full overflow-hidden bg-black">
                  <iframe
                    key={current.id}
                    src={embedUrl(current)}
                    title={current.title}
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full border-0"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h2 className="font-display text-lg uppercase tracking-[0]">
                    {current.title}
                  </h2>
                  {current.client ? (
                    <p className="label text-muted-foreground">
                      {current.client}
                    </p>
                  ) : null}
                  {current.year ? (
                    <p className="label ml-auto shrink-0 tabular-nums text-muted-foreground">
                      {current.year}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* The rest, in a row that scrolls sideways when it must. */}
            {others.length ? (
              <ul
                aria-label="More films"
                className="flex w-[min(70vw,calc((100dvh-16rem)*16/9))] max-w-full gap-3 overflow-x-auto pb-2"
              >
                {others.map((v) => {
                  const poster = posterFor(v);
                  return (
                    <li key={v.id} className="w-40 shrink-0 sm:w-48">
                      <button
                        type="button"
                        onClick={() => onChange(v)}
                        aria-label={`Play ${v.title}`}
                        className={cn(
                          "group relative aspect-video w-full overflow-hidden bg-card press active:scale-[0.98]",
                          "opacity-70 transition-opacity duration-200 hoverable:hover:opacity-100 focus-visible:opacity-100",
                        )}
                      >
                        {poster ? (
                          <Image
                            src={poster}
                            alt=""
                            fill
                            sizes="12rem"
                            className="object-cover transition-transform duration-500 ease-[var(--ease-out-strong)] hoverable:group-hover:scale-[1.04] motion-reduce:transition-none"
                          />
                        ) : null}
                      </button>
                      <p className="label mt-2 truncate text-muted-foreground">
                        {v.title}
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
            className="flex shrink-0 items-center justify-between gap-6 px-6 pb-6 sm:px-10 sm:pb-8"
          >
            <p className="label text-muted-foreground">
              {at + 1} / {videos.length}
            </p>
            <div className="flex items-center gap-2">
              <ViewerButton onClick={() => step(-1)} label="Previous film">
                &larr;
              </ViewerButton>
              <ViewerButton onClick={() => step(1)} label="Next film">
                &rarr;
              </ViewerButton>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="label glass ml-4 px-4 py-2.5 text-muted-foreground press hoverable:hover:text-foreground active:scale-[0.97]"
                >
                  Close
                </button>
              </Dialog.Close>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ViewerButton({
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
      className="glass flex size-11 items-center justify-center text-muted-foreground press hoverable:hover:text-foreground active:scale-[0.95]"
    >
      {children}
    </button>
  );
}
