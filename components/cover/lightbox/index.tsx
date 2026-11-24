"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import { Dialog, VisuallyHidden } from "radix-ui";
import type { Frame } from "@/lib/work/work-types";
import {
  zoomOpen,
  zoomClose,
  lockScroll,
  pushHistory,
  DECODE_CAP_MS,
  type ZoomTrip,
} from "@/components/cover/zoom";
import { pictureFor, Stage } from "./stage";
import { useSwipe } from "./use-swipe";

/* ── the lightbox ─────────────────────────────────────────────────
 * A frame at the size of the screen, paged with the arrow keys.
 *
 * Shared by the project strips, the galleries and the cover-art sheet:
 * those lay their frames out very differently, but what happens when you
 * click one is the same, and it is the part with the keyboard handling
 * and the focus behaviour in it.
 *
 * The trip is `components/cover/zoom.ts`: the frame pressed grows into the viewer and
 * the viewer's picture shrinks back into whichever frame it now is. One
 * picture moving, on the browser's View Transitions where it has them and
 * on a FLIP transform elsewhere.
 * ─────────────────────────────────────────────────────────────── */

/** The box the trip starts from and lands in: the frame's clipping cell
    where it has one, the picture itself elsewhere. */
const boxOf = (el: HTMLElement): HTMLElement =>
  el.closest<HTMLElement>(".strip-cell, button, a") ?? el;

const rectOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
};

/** Says a viewer is up, for the page's own popstate listeners. */
const markViewer = (on: boolean) => {
  if (on) document.documentElement.setAttribute("data-viewer", "");
  else document.documentElement.removeAttribute("data-viewer");
};

const viewerBox = () =>
  document.querySelector<HTMLElement>("[data-zoom-box]");
const viewerPicture = () =>
  document.querySelector<HTMLImageElement>("[data-zoom-box] img[data-lightbox-picture]");
const viewerBackdrop = () =>
  document.querySelector<HTMLElement>("[data-zoom-backdrop]");
const viewerChrome = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-zoom-chrome]"));

/* The full-size picture, fetched and decoded before the trip starts.
   The viewer asks for `100vw`; the frame in the strip asked for a third
   of that, so opening one is a new file and a decode of several
   megapixels, which would land in the middle of the animation. The
   frame's own `srcset` lists every width of the same photograph, so the
   one the viewer is about to choose is warmed first. Each candidate is
   read as URL and width, not split on commas: the CDN's URLs carry
   commas of their own. Capped, so a slow connection never holds the
   press. */
function warm(from: HTMLElement | null): Promise<void> {
  const img =
    from instanceof HTMLImageElement ? from : from?.querySelector("img");
  const set = img?.srcset ?? "";
  if (!set) return Promise.resolve();
  const want = window.innerWidth * (window.devicePixelRatio || 1);
  const widths = Array.from(set.matchAll(/(\S+)\s+(\d+)w/g))
    .map((m) => ({ url: m[1], w: parseInt(m[2], 10) }))
    .filter((c) => c.w > 0)
    .sort((a, b) => a.w - b.w);
  const pick = widths.find((c) => c.w >= want) ?? widths[widths.length - 1];
  if (!pick) return Promise.resolve();
  const copy = new window.Image();
  copy.src = pick.url;
  return Promise.race([
    copy.decode().catch(() => {}),
    new Promise<void>((r) => window.setTimeout(r, DECODE_CAP_MS)),
  ]).then(() => undefined);
}

/** Is enough of this frame in the window, and visible, to travel to? */
const onScreen = (el: HTMLElement | null) => {
  if (!el) return false;
  // Faded out counts as absent. A sleeve mounts both its sides and
  // crossfades them under the pointer, so half the frames on a cover art
  // page are sitting there at zero opacity: a snapshot of one of those is
  // a picture nobody can see, travelling.
  if (Number(getComputedStyle(el).opacity) < 0.05) return false;
  const r = el.getBoundingClientRect();
  const w = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  const h = Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0);
  if (w <= 0 || h <= 0) return false;
  return (w * h) / (r.width * r.height) > 0.6;
};

/** Where the frame lives now, whether or not it is on screen: the close
    scrolls it into view itself. Absent means shrink to the middle. */
const homeOf = (el: HTMLElement | null) =>
  el && el.isConnected && Number(getComputedStyle(el).opacity) >= 0.05
    ? boxOf(el)
    : null;

/**
 * Which frame is open, and how it got there.
 *
 * A hook rather than state inside `Lightbox`, because the thing that opens
 * it is whatever the surrounding layout happens to be, and that has to stay
 * the caller's business.
 */
export function useLightbox(frames: Frame[]) {
  const count = frames.length;
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  /* The open has landed and no close has begun: the only time the
     full-size copy is on the stage (`Stage`), so it never rides a trip
     that animates the picture under it. */
  const [settled, setSettled] = React.useState(false);

  // Focus goes back to the frame that was pressed. Radix would return it to
  // its own trigger, and there isn't one: the lightbox is opened from
  // whichever of twenty-odd frames was clicked.
  const opener = React.useRef<HTMLElement | null>(null);
  /* The element the picture came out of, and which index it was. A cover
     art cell knows this and the DOM does not: the grid holds one side of a
     sleeve, so looking the picture up by its source finds nothing half the
     time. */
  const origin = React.useRef<HTMLElement | null>(null);
  const originAt = React.useRef(-1);
  const trip = React.useRef<ZoomTrip | null>(null);
  const closing = React.useRef(false);
  /* A press whose picture is still decoding. A close in that window,
     Escape or the back button pressed quickly, abandons the open rather
     than letting the viewer come up after it. */
  const pending = React.useRef(false);
  /** The scroll lock, undone as the close starts. */
  const unlock = React.useRef<((restore?: boolean) => void) | null>(null);
  /** The history entry, taken off once the close has landed. */
  const unpush = React.useRef<(() => void) | null>(null);

  const close = React.useCallback(
    (to: HTMLElement | null) => {
      if (pending.current) {
        pending.current = false;
        markViewer(false);
        return;
      }
      if (closing.current) return;
      closing.current = true;
      // Before the rects are read: the trip flies the fitted picture home.
      flushSync(() => setSettled(false));
      unlock.current?.();
      unlock.current = null;
      // An open still in flight is stopped where it is, and the way home
      // starts from there.
      const box = viewerBox();
      const dragged = box?.parentElement?.style.transform;
      const startRect =
        trip.current?.interrupt() ?? (dragged && box ? rectOf(box) : null);
      trip.current = zoomClose({
        box,
        picture: viewerPicture(),
        to,
        startRect,
        backdrop: viewerBackdrop,
        chrome: viewerChrome,
        unmount: () => flushSync(() => setOpen(false)),
      });
      trip.current.finished.finally(() => {
        unpush.current?.();
        unpush.current = null;
        trip.current = null;
        closing.current = false;
        markViewer(false);
        opener.current?.focus({ preventScroll: true });
      });
    },
    [],
  );

  /** `entry: false` takes no history entry, so Back leaves the page with the viewer: a cover opened on arrival from the home (QA on #1313: it took two Backs). */
  const show = (i: number, el?: HTMLElement | null, entry = true) => {
    if (open || trip.current) return;
    opener.current = document.activeElement as HTMLElement | null;
    const src = frames[i]?.src;
    const found = el ?? (src ? pictureFor(src) : null);
    const from = onScreen(found) ? boxOf(found as HTMLElement) : null;
    origin.current = found ?? null;
    originAt.current = i;
    markViewer(true);
    pending.current = true;
    void warm(found ?? null).then(() => {
      if (!pending.current) return;
      pending.current = false;
      unlock.current = lockScroll();
      trip.current = zoomOpen({
        from,
        mount: () =>
          flushSync(() => {
            setIndex(i);
            setOpen(true);
          }),
        box: viewerBox,
        picture: viewerPicture,
        backdrop: viewerBackdrop,
        chrome: viewerChrome,
      });
      trip.current.finished.finally(() => {
        if (closing.current) return;
        trip.current = null;
        setSettled(true);
      });
      // The back button closes it the way the close button does.
      if (entry) unpush.current = pushHistory(() => closeRef.current());
      /* No entry: Back leaves the page. The lock goes the moment it starts, before the next page renders and
         its scroll is put back: Safari clamps that restore under the locked root. */
      else {
        const lock = unlock.current;
        addEventListener(
          "popstate",
          () => {
            // only this open's lock: closed with X and another opened since, this Back is that one's
            if (unlock.current !== lock) return;
            lock?.(false);
            unlock.current = null;
          },
          { once: true },
        );
      }
    });
  };

  /* Back to whichever frame is showing now, which after a few arrow keys
     is not the one that was pressed. Off screen it is scrolled to, behind
     the backdrop, before the picture goes there. */
  const closeTo = () => {
    const src = frames[index]?.src;
    const home =
      index === originAt.current && origin.current
        ? origin.current
        : src
          ? pictureFor(src)
          : null;
    close(homeOf(home));
  };
  // Leaving the page with the viewer up (an `entry: false` open): the next page keeps no lock and no viewer mark, and its own scroll.
  React.useEffect(
    () => () => {
      if (!unlock.current) return;
      unlock.current(false);
      unlock.current = null;
      unpush.current?.();
      markViewer(false);
    },
    [],
  );
  const closeRef = React.useRef(closeTo);
  React.useEffect(() => {
    closeRef.current = closeTo;
  });

  const onOpenChange = (next: boolean) => {
    if (next) return;
    closeRef.current();
  };

  const step = React.useCallback(
    (delta: number) => setIndex((i) => (i + delta + count) % count),
    [count],
  );

  // Arrow keys page through the sequence. Radix handles Escape and the focus
  // trap once the viewer is up; before that, Escape abandons the press.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pending.current) closeRef.current();
      if (!open) return;
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  return { open, index, show, onOpenChange, step, settled };
}

export function Lightbox({
  frames,
  name,
  open,
  index,
  onOpenChange,
  step,
  settled,
  note,
  place,
}: {
  frames: Frame[];
  /** What the sequence is, for the dialog's accessible title. */
  name: string;
  /** A line of the page's own above the viewer's floor (Cover art's sound line). */
  note?: React.ReactNode;
  /** Where the counter says the visitor is, when a step is not one item (Cover art: a sleeve's back is the same release). */
  place?: [at: number, of: number];
} & Omit<ReturnType<typeof useLightbox>, "show">) {
  const current = frames[index];
  const [at, of] = place ?? [index + 1, frames.length];
  const { ref: picture, handlers: swipe } = useSwipe({
    onStep: step,
    onDismiss: () => onOpenChange(false),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* The backdrop and the chrome start unseen and are faded by the
            trip on their own curves (`components/cover/zoom.ts`). */}
        <Dialog.Overlay
          data-zoom-backdrop
          className="fixed inset-0 z-50 bg-background/95"
          style={{ opacity: 0 }}
        />

        <Dialog.Content
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col outline-none"
        >
          <VisuallyHidden.Root>
            <Dialog.Title>{`${name}, frame ${at} of ${of}`}</Dialog.Title>
          </VisuallyHidden.Root>

          {/* Anywhere that is not the picture closes it. The check is against
              the element itself, so a click on the frame stays put and the
              controls below keep their own jobs. */}
          {current ? (
            <Stage
              frame={current}
              alt={current.alt || `${name}, frame ${index + 1}`}
              pictureRef={picture}
              swipe={swipe}
              sharp={settled}
              onClose={() => onOpenChange(false)}
              /* Julian: the photographs either side, at the edges. Not
                 wrapped: the first has nothing before it. */
              prev={frames[index - 1]}
              next={frames[index + 1]}
              onStep={step}
              index={index}
            />
          ) : null}

          {note ? (
            <div data-zoom-chrome className="shrink-0 px-6 pt-3 sm:px-10" style={{ opacity: 0 }}>
              {note}
            </div>
          ) : null}

          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) onOpenChange(false);
            }}
            /* Its own space above the picture as well as below it, so the
               row reads as the viewer's floor rather than as something
               resting on the photograph. */
            className="flex shrink-0 items-center justify-between gap-6 px-6 pb-6 pt-4 sm:px-10 sm:pb-8 sm:pt-6"
          >
            {/* Read out as it changes: the counter is the one thing that
                says where in the sequence a keyboard visitor is. */}
            <p
              data-zoom-chrome
              aria-live="polite"
              className="label text-muted-foreground"
              style={{ opacity: 0 }}
            >
              {at} / {of}
            </p>

            <div
              data-zoom-chrome
              className="flex items-center gap-2"
              style={{ opacity: 0 }}
            >
              <LightboxButton onClick={() => step(-1)} label="Previous frame">
                &larr;
              </LightboxButton>
              <LightboxButton onClick={() => step(1)} label="Next frame">
                &rarr;
              </LightboxButton>
              <Dialog.Close asChild>
                <button
                  type="button"
                  data-ring="Close"
                  data-stick=""
                  className="label glass ml-4 px-4 py-2.5 text-muted-foreground press hoverable:hover:text-foreground active:scale-[0.97]"
                >
                  {/* A box of its own, for the grow when the pointer
                      sticks (`globals.css`). */}
                  <span className="block">Close</span>
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
      // The word under the pointer is the short one: the label says
      // "Previous frame" for a screen reader, which has no picture in
      // front of it; a tag over the picture does.
      data-ring={label.replace(" frame", "")}
      data-stick=""
      // 44px minimum target: the control someone taps repeatedly on a
      // phone gets a real hit area rather than an icon's worth.
      className="glass flex h-11 w-11 items-center justify-center text-base press active:scale-[0.97]"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
