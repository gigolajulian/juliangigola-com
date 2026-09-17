"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { Dialog, VisuallyHidden } from "radix-ui";
import { rubberband } from "@/lib/utils";
import type { Frame } from "@/lib/work-types";
import {
  zoomOpen,
  zoomClose,
  lockScroll,
  pushHistory,
  DECODE_CAP_MS,
  type ZoomTrip,
} from "@/lib/zoom";

/* ── the lightbox ─────────────────────────────────────────────────
 * A frame at the size of the screen, paged with the arrow keys.
 *
 * Shared by the project strips, the galleries and the cover-art sheet:
 * those lay their frames out very differently, but what happens when you
 * click one is the same, and it is the part with the keyboard handling
 * and the focus behaviour in it.
 *
 * The trip is `lib/zoom.ts`: the frame pressed grows into the viewer and
 * the viewer's picture shrinks back into whichever frame it now is. One
 * picture moving, on the browser's View Transitions where it has them and
 * on a FLIP transform elsewhere.
 * ─────────────────────────────────────────────────────────────── */

const pictureFor = (src: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`img[data-frame="${CSS.escape(src)}"]`);

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
   megapixels, and both used to land in the middle of the animation. The
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
  const unlock = React.useRef<(() => void) | null>(null);
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

  const show = (i: number, el?: HTMLElement | null) => {
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
        if (!closing.current) trip.current = null;
      });
      // The back button closes it the way the close button does.
      unpush.current = pushHistory(() => closeRef.current());
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

  return { open, index, show, onOpenChange, step };
}

/* ── the swipe ────────────────────────────────────────────────────
 * On a phone the frame follows the finger. Sideways pages the sequence,
 * down lets go of it: the picture shrinks and fades with the distance,
 * and a release past a quarter of the height, or a flick, hands it to the
 * close from wherever it is. Under that it springs back to the middle.
 *
 * Pointer Events with capture, so a swipe that leaves the picture's box
 * keeps tracking. Mice are left out: with a pointer the arrows, the keys
 * and a click outside are all quicker than a drag.
 * ─────────────────────────────────────────────────────────────── */

/** Above this, in px per ms, a release commits whatever it was doing. */
const FLICK = 0.11;
/** Before this many px the gesture has no axis; a tap stays a tap. */
const SLOP = 10;

type Sample = { t: number; x: number; y: number };

function useSwipe({
  onStep,
  onDismiss,
}: {
  onStep: (delta: 1 | -1) => void;
  onDismiss: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{
    id: number;
    x0: number;
    y0: number;
    axis: "x" | "y" | null;
    samples: Sample[];
  } | null>(null);
  // Set while a gesture moved, so the click that can follow a release does
  // not also close the lightbox.
  const moved = React.useRef(false);

  const place = (
    x: number,
    y: number,
    scale: number,
    opacity: number,
    settle: boolean,
  ) => {
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.style.transition =
      settle && !still
        ? "transform 360ms var(--ease-spring), opacity 200ms var(--ease-out-strong)"
        : "none";
    el.style.transform =
      x || y || scale !== 1
        ? `translate(${x}px, ${y}px) scale(${scale})`
        : "";
    el.style.opacity = opacity === 1 ? "" : String(opacity);
  };

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.pointerType === "mouse" || !e.isPrimary) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      axis: null,
      samples: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }],
    };
    moved.current = false;
    place(0, 0, 1, 1, false);
  };

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    d.samples.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (d.samples.length > 6) d.samples.shift();

    if (!d.axis) {
      if (Math.hypot(dx, dy) < SLOP) return;
      d.axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      moved.current = true;
    }
    const el = e.currentTarget;
    if (d.axis === "x") {
      place(dx, 0, 1, 1, false);
    } else {
      // Down is the gesture; up is resisted.
      const y = dy > 0 ? dy : rubberband(dy, el.clientHeight);
      const share = Math.max(0, dy) / el.clientHeight;
      place(0, y, 1 - 0.4 * Math.min(1, share), Math.max(0.3, 1 - share), false);
    }
  };

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    const el = e.currentTarget;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    const first = d.samples[0];
    const last = d.samples[d.samples.length - 1];
    const dt = Math.max(1, last.t - first.t);
    const vx = (last.x - first.x) / dt;
    const vy = (last.y - first.y) / dt;

    if (d.axis === "x") {
      const commit =
        Math.abs(dx) > el.clientWidth * 0.3 || Math.abs(vx) > FLICK;
      // Sign, not position: a flick back the way it came reverses.
      const dir: 1 | -1 = (Math.abs(vx) > FLICK ? vx : dx) < 0 ? 1 : -1;
      if (commit) {
        onStep(dir);
        // The next frame starts a little in from the side it is coming from
        // and settles: one strip moving, not one picture replaced by another.
        place(dir * -el.clientWidth * 0.2, 0, 1, 0, false);
        requestAnimationFrame(() => place(0, 0, 1, 1, true));
        return;
      }
    } else if (d.axis === "y") {
      const commit = dy > el.clientHeight * 0.25 || vy > FLICK;
      if (commit) {
        // The close measures the picture where the finger left it.
        onDismiss();
        return;
      }
    }
    place(0, 0, 1, 1, true);
  };

  const onClickCapture: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (moved.current) {
      e.stopPropagation();
      moved.current = false;
    }
  };

  return {
    ref,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onClickCapture,
    },
  };
}

/* The picture's box, in pixels: as large as the area allows at the
   picture's own shape. Measured rather than left to CSS, because the trip
   is a transform of this box and it has to be exactly the picture, no
   letterbox inside it. */
function useFit(
  area: React.RefObject<HTMLDivElement | null>,
  width: number,
  height: number,
) {
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(
    null,
  );
  React.useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    /* The content box, not the padding box. `clientWidth` and
       `clientHeight` count the padding as room, so the stage's own
       margin was being spent on the picture: a tall frame came out 80px
       taller than the space inside the padding, ran to the top of the
       window and sat hard against the controls with nothing between
       them. Julian saw that as the controls overlaying the picture. The
       observer hands the content box straight over; the first
       measurement, before there is an entry, takes the padding off by
       hand. */
    const fit = (content?: DOMRectReadOnly) => {
      let w = content?.width;
      let h = content?.height;
      if (w === undefined || h === undefined) {
        const pad = window.getComputedStyle(el);
        w = el.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
        h = el.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom);
      }
      const s = Math.min(w / width, h / height);
      setSize({ w: Math.round(width * s), h: Math.round(height * s) });
    };
    fit();
    const ro = new ResizeObserver(([entry]) => fit(entry.contentRect));
    ro.observe(el);
    return () => ro.disconnect();
  }, [area, width, height]);
  return size;
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
  const { ref: picture, handlers: swipe } = useSwipe({
    onStep: step,
    onDismiss: () => onOpenChange(false),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* The backdrop and the chrome start unseen and are faded by the
            trip on their own curves (`lib/zoom.ts`). */}
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
            <Dialog.Title>{`${name}, frame ${index + 1} of ${frames.length}`}</Dialog.Title>
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
              onClose={() => onOpenChange(false)}
            />
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
              {index + 1} / {frames.length}
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

function Stage({
  frame,
  alt,
  pictureRef,
  swipe,
  onClose,
}: {
  frame: Frame;
  alt: string;
  pictureRef: React.RefObject<HTMLDivElement | null>;
  swipe: ReturnType<typeof useSwipe>["handlers"];
  onClose: () => void;
}) {
  const area = React.useRef<HTMLDivElement>(null);
  const size = useFit(area, frame.width, frame.height);
  /* Under the picture while it arrives.
     The viewer asks for a wider copy than the strip did, so on a slow
     connection the file is still in flight when the trip starts — the
     press waits `DECODE_CAP_MS` and no longer. Measured on production:
     the box was empty for the first 400ms and the file landed at 641ms,
     which is the blank Julian saw. The copy the page already decoded is
     the same photograph and costs nothing, so it holds the box until the
     full one paints; the frame's own colour covers a frame that is not
     on the page, after a few arrow keys. */
  const under = React.useMemo(
    () => {
      const el = pictureFor(frame.src);
      return el instanceof HTMLImageElement ? el.currentSrc : "";
    },
    [frame.src],
  );
  return (
    <div
      ref={area}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-10"
    >
      {/* What the finger moves. Stays mounted across a step, so the offset
          it was released at is where the next frame starts from. */}
      <div
        ref={pictureRef}
        data-ring="Zoom out"
        {...swipe}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="flex h-full w-full touch-none select-none items-center justify-center"
      >
        {/* The box the trip transforms: exactly the picture, clipped. */}
        <div
          data-zoom-box
          className="relative shrink-0 overflow-hidden bg-cover bg-center"
          style={{
            ...(size ? { width: size.w, height: size.h } : { width: 0, height: 0 }),
            backgroundColor: frame.color,
            ...(under ? { backgroundImage: `url("${under}")` } : null),
          }}
        >
          <Image
            key={frame.src}
            data-lightbox-picture
            src={frame.src}
            alt={alt}
            width={frame.width}
            height={frame.height}
            sizes="100vw"
            priority
            draggable={false}
            className="block h-full w-full object-contain"
          />
        </div>
      </div>
    </div>
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
      // 44px minimum target: the control someone taps repeatedly on a
      // phone gets a real hit area rather than an icon's worth.
      className="glass flex h-11 w-11 items-center justify-center rounded-full text-base press active:scale-[0.97]"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
