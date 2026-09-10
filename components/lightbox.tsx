"use client";

import * as React from "react";
import Image from "next/image";
import { Dialog, VisuallyHidden } from "radix-ui";
import { cn } from "@/lib/utils";
import type { Frame } from "@/lib/work-types";

/* ── the lightbox ─────────────────────────────────────────────────
 * A frame at the size of the screen, paged with the arrow keys.
 *
 * Shared by the project galleries and the cover-art sheet: those two lay
 * their frames out very differently, but what happens when you click one is
 * the same, and it is the part with the keyboard handling and the focus
 * behaviour in it.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Which frame is open, and how it got there.
 *
 * A hook rather than state inside `Lightbox`, because the thing that opens it
 * is whatever the surrounding layout happens to be — a row of paired frames,
 * a grid of covers — and that has to stay the caller's business.
 */
export function useLightbox(count: number) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  // Radix returns focus to its own `Dialog.Trigger`, and there isn't one here
  // — the lightbox is opened from whichever of twenty-odd frames was clicked.
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
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count],
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

  return { open, index, show, onOpenChange, step };
}

export function Lightbox({
  frames,
  name,
  open,
  index,
  onOpenChange,
  step,
}: {
  frames: Frame[];
  /** What the sequence is, for the dialog's accessible title. */
  name: string;
} & Omit<ReturnType<typeof useLightbox>, "show">) {
  const current = frames[index];

  return (
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
            <Dialog.Title>{`${name} — frame ${index + 1} of ${frames.length}`}</Dialog.Title>
          </VisuallyHidden.Root>

          <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10">
            {current ? (
              <Image
                key={current.src}
                src={current.src}
                alt={current.alt || `${name} — frame ${index + 1}`}
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
