"use client";

import * as React from "react";
import { flushSync } from "react-dom";
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
/* ── the trip ─────────────────────────────────────────────────────
 * Pressing a frame does not open a dialog over it. The frame lifts off the
 * page and grows to the middle of the screen; closing sends it back.
 *
 * The browser's View Transitions API directly, not React's `<ViewTransition>`
 * — and the difference is the point. React's component pairs a name that is
 * *unmounting* with one that is *mounting*, which is what a route change is.
 * Here the frame in the gallery stays on the page under the lightbox, so
 * both ends exist at once and React refuses the pair as a duplicate. The
 * browser has no such rule: it captures a snapshot, runs the update, and
 * captures another, and a name is allowed to be on one element before and a
 * different element after. So the name is put on the pressed picture, moved
 * to the lightbox's picture inside the update, and taken off afterwards.
 *
 * Every frame that can open carries `data-frame` with its path, which is how
 * the one to lift — or land in — is found. The route morph on the project's
 * first frame (`cover-<slug>`, see `gallery.tsx`) is React's and untouched:
 * that one crosses pages, and this one never does.
 * ─────────────────────────────────────────────────────────────── */

/** The one name the trip uses. On one element at a time, by construction. */
const NAME = "lightbox-frame";

const pictureFor = (src: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`img[data-frame="${CSS.escape(src)}"]`);

/**
 * Runs `update` as a view transition with the name travelling from `from`
 * to `to`. Either end may be absent; the lightbox's own picture carries the
 * name in its style, so it is never passed here. Without the API, or with
 * reduced motion, the update simply runs.
 */
function travel(
  from: HTMLElement | null,
  update: () => void,
  to: HTMLElement | null,
) {
  if (
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    update();
    return;
  }
  if (from) from.style.viewTransitionName = NAME;
  const transition = document.startViewTransition(() => {
    // Synchronous, so the new snapshot is of the updated page.
    flushSync(update);
    if (from) from.style.viewTransitionName = "";
    if (to) to.style.viewTransitionName = NAME;
  });
  transition.finished.finally(() => {
    if (to) to.style.viewTransitionName = "";
  });
}

export function useLightbox(frames: Frame[]) {
  const count = frames.length;
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  // Radix returns focus to its own `Dialog.Trigger`, and there isn't one here
  // — the lightbox is opened from whichever of twenty-odd frames was clicked.
  // Without this, closing drops focus on <body> and a keyboard visitor has to
  // tab from the top of the page again to get back to where they were.
  const opener = React.useRef<HTMLElement | null>(null);

  const show = (i: number) => {
    opener.current = document.activeElement as HTMLElement | null;
    const src = frames[i]?.src;
    travel(
      src ? pictureFor(src) : null,
      () => {
        setIndex(i);
        setOpen(true);
      },
      null,
    );
  };

  const onOpenChange = (next: boolean) => {
    if (next) {
      setOpen(true);
      return;
    }
    // Back to whichever frame is showing now, which after a few arrow keys
    // is not the one that was pressed.
    const src = frames[index]?.src;
    travel(null, () => setOpen(false), src ? pictureFor(src) : null);
    opener.current?.focus();
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
            // A fade only. The scale it used to carry is the frame's own
            // job now: it arrives from where it was pressed.
            "animate-in fade-in duration-200 ease-out motion-reduce:animate-none",
          )}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>{`${name} — frame ${index + 1} of ${frames.length}`}</Dialog.Title>
          </VisuallyHidden.Root>

          <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10">
            {current ? (
              <Image
                key={current.src}
                // The destination on the way in and the origin on the way out —
                // see `travel`. Only one of these is ever mounted.
                style={{ viewTransitionName: NAME }}
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
                  className="label glass ml-4 rounded-full px-4 py-2.5 text-muted-foreground press hoverable:hover:text-foreground active:scale-[0.97]"
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
      className="glass flex h-11 w-11 items-center justify-center rounded-full text-base press active:scale-[0.97]"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
