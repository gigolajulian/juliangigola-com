"use client";

import * as React from "react";
import { Orb } from "@/components/orb";
import { flushSync } from "react-dom";
import Image from "next/image";
import { Dialog, VisuallyHidden } from "radix-ui";
import { cn, rubberband } from "@/lib/utils";
import TiltedCard from "@/components/TiltedCard";
import type { Frame } from "@/lib/work-types";
import {
  zoomOpen,
  zoomClose,
  lockScroll,
  pushHistory,
  DECODE_CAP_MS,
  type ZoomTrip,
} from "@/lib/zoom";
import { matches } from "@/lib/device";

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
        if (closing.current) return;
        trip.current = null;
        setSettled(true);
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

  return { open, index, show, onOpenChange, step, settled };
}

/* ── the swipe ────────────────────────────────────────────────────
 * On a phone the frame follows the finger. Sideways pages the sequence,
 * down lets go of it: the picture shrinks and fades with the distance,
 * and a release past a quarter of the height, or a flick, hands it to the
 * close from wherever it is. Under that it springs back to the middle.
 *
 * Pointer Events with capture, so a swipe that leaves the picture's box
 * keeps tracking. A mouse drags it too, by its main button (Julian: drag
 * to the next and the one before).
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
    if (e.button !== 0 || !e.isPrimary) return;
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
  // `vw`: the area's own width, for the neighbours' room either side.
  const [size, setSize] = React.useState<{ w: number; h: number; vw: number } | null>(
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
      /* A landscape frame a little short of the width, so the frames
         either side show past it (Julian: scale down slightly to show the
         next and before). Not on a phone, which has no sides. */
      if (width > height && matches("wide")) w *= 0.76;
      const s = Math.min(w / width, h / height);
      setSize({ w: Math.round(width * s), h: Math.round(height * s), vw: el.clientWidth });
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
  settled,
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


/* ── scroll to zoom, drag to look around ──────────────────────────
 * A wheel over the picture zooms it, up to three times in and never
 * smaller than it arrived: fitted to the window is the photograph, and
 * anything under that is a picture sitting in a hole. The point under
 * the pointer stays where it is, so zooming towards a face grows the
 * face and not the middle of the frame, and past fit the hand moves it
 * with the offset held to the overhang, so it cannot be dragged away.
 *
 * The transform goes on a wrapper of its own, between the box and the
 * picture. `lib/zoom.ts` flies the box and animates the picture inside it,
 * and a finished Web Animation holds whatever transform it ended on, so a
 * zoom written to either of them is set and then ignored. Measured before
 * the wrapper: scale 1.9 in state, matrix(1, 0, 0, 1, 0, 0) on screen.
 * ─────────────────────────────────────────────────────────────── */
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

function useZoom(
  box: React.RefObject<HTMLDivElement | null>,
  key: string,
  swipe: ReturnType<typeof useSwipe>["handlers"],
) {
  const [scale, setScale] = React.useState(1);
  const [at, setAt] = React.useState({ x: 0, y: 0 });
  const [held, setHeld] = React.useState(false);
  const drag = React.useRef<{ id: number; x: number; y: number } | null>(null);
  /* Every finger on the picture, and the pinch the pair of them began.
     A tablet has no wheel, so this is the only way in: two fingers set
     the scale by how far apart they are against how far apart they
     started, anchored on the point between them, which is the same
     arithmetic the wheel does around the pointer. */
  const pts = React.useRef(new Map<number, { x: number; y: number }>());
  const pinch = React.useRef<{
    gap: number;
    scale: number;
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  // Set by a pan, read by the click that follows it: a drag across the
  // picture ends in a click on the wrapper, and the wrapper closes the
  // viewer. Measured: every look around shut the photograph.
  const moved = React.useRef(false);

  /* A new frame is a new photograph, not the last one at the last zoom.
     Adjusted while rendering rather than in an effect: React re-runs this
     component before anything paints, so the new picture never appears
     for a frame at the old zoom on its way back to one. */
  const [was, setWas] = React.useState(key);
  if (was !== key) {
    setWas(key);
    setScale(1);
    setAt({ x: 0, y: 0 });
  }

  // How far the picture may move before its own edge comes past the box.
  const clamp = React.useCallback(
    (s: number, x: number, y: number) => {
      const el = box.current;
      if (!el || s <= 1) return { x: 0, y: 0 };
      const mx = (el.clientWidth * (s - 1)) / 2;
      const my = (el.clientHeight * (s - 1)) / 2;
      return {
        x: Math.max(-mx, Math.min(mx, x)),
        y: Math.max(-my, Math.min(my, y)),
      };
    },
    [box],
  );

  /* Non-passive, and on the element rather than through React: React
     attaches wheel listeners at the root as passive, so a handler in JSX
     cannot stop the page behind from scrolling with it. */
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      // Where the pointer is, measured from the middle of the box.
      const px = e.clientX - (r.left + r.width / 2);
      const py = e.clientY - (r.top + r.height / 2);
      setScale((was) => {
        const next = Math.min(
          ZOOM_MAX,
          Math.max(ZOOM_MIN, was * Math.exp(-e.deltaY / 420)),
        );
        setAt((o) =>
          clamp(next, px - ((px - o.x) * next) / was, py - ((py - o.y) * next) / was),
        );
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [box, clamp]);

  /* One set of handlers for every gesture on the picture. What a press
     turns into depends on how many fingers arrive and how far in the
     photograph already is:

       two fingers        pinch, at any zoom
       one, zoomed in     the hand, moving the picture inside its box
       one, at fit        the swipe, which steps and dismisses as before

     The swipe is handed the press only in that last case, and is told to
     let go the moment a second finger lands, or it would still be tracking
     a drag underneath the pinch. */
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const gapOf = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      const el = box.current;
      const r = el?.getBoundingClientRect();
      const m = mid(a, b);
      pinch.current = {
        gap: gapOf(a, b) || 1,
        scale,
        x: r ? m.x - (r.left + r.width / 2) : 0,
        y: r ? m.y - (r.top + r.height / 2) : 0,
        ox: at.x,
        oy: at.y,
      };
      drag.current = null;
      moved.current = true;
      setHeld(true);
      swipe.onPointerCancel?.(e);
      return;
    }
    if (scale > 1) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      moved.current = false;
      setHeld(true);
      return;
    }
    swipe.onPointerDown?.(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pts.current.has(e.pointerId)) {
      pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const p = pinch.current;
    if (p && pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      const next = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, (p.scale * gapOf(a, b)) / p.gap),
      );
      setScale(next);
      setAt(
        clamp(
          next,
          p.x - ((p.x - p.ox) * next) / p.scale,
          p.y - ((p.y - p.oy) * next) / p.scale,
        ),
      );
      return;
    }
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (dx || dy) moved.current = true;
      d.x = e.clientX;
      d.y = e.clientY;
      setAt((o) => clamp(scale, o.x + dx, o.y + dy));
      return;
    }
    if (scale === 1) swipe.onPointerMove?.(e);
  };

  const release = (
    e: React.PointerEvent<HTMLDivElement>,
    cancelled: boolean,
  ) => {
    const wasPinching = pts.current.size >= 2;
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    if (drag.current?.id === e.pointerId) drag.current = null;
    if (!drag.current && !pinch.current) setHeld(false);
    if (!wasPinching && scale === 1) {
      if (cancelled) swipe.onPointerCancel?.(e);
      else swipe.onPointerUp?.(e);
    }
  };

  const pan = {
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => release(e, false),
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => release(e, true),
  };
  return {
    scale,
    pan,
    /** True while the click that follows a pan is still to come. */
    dragged: () => moved.current,
    /* The word at the pointer says the wheel does something here, and the
       cursor says whether there is anything to drag. Julian asked, and
       then for one word: VIEW, DRAG, ZOOM, SCROLL. */
    ring: "Scroll",
    style: {
      transform: `translate(${at.x}px, ${at.y}px) scale(${scale})`,
      transition: held ? "none" : "transform 180ms var(--ease-out-strong)",
      cursor: scale > 1 ? (held ? "grabbing" : "grab") : undefined,
    } as React.CSSProperties,
  };
}
/* Every copy of a frame the viewer has painted, by frame. A step moves
   the middle picture to a side and a side one to the middle, each a new
   element that paints a frame late; the copy already painted goes under
   it, so nothing is blank for that frame. */
const painted = new Map<string, string>();
const paint = (src: string) => (e: React.SyntheticEvent<HTMLImageElement>) =>
  painted.set(src, e.currentTarget.currentSrc);
/** The best copy of a frame already decoded: the viewer's, or the page's. */
const decodedCopy = (src: string) => {
  const el = pictureFor(src);
  return painted.get(src) ?? (el instanceof HTMLImageElement ? el.currentSrc : "");
};
const sideUnder = (src: string) => {
  const url = decodedCopy(src);
  return url ? `url("${url}")` : undefined;
};

/* A step between frames (Julian: it snapped, smoothen). Was 650ms on an
   ease that ran seven tenths of the way in the first 150, which read as a
   jump; the new frame also started half transparent, a grey ghost over
   the one leaving. Longer, on an even ease-out, and opaque throughout. */
const STEP_MS = 900;
const STEP_EASE = "cubic-bezier(0.33, 1, 0.68, 1)";

function Stage({
  frame,
  alt,
  pictureRef,
  swipe,
  sharp,
  onClose,
  prev,
  next,
  onStep,
  index,
}: {
  frame: Frame;
  alt: string;
  pictureRef: React.RefObject<HTMLDivElement | null>;
  swipe: ReturnType<typeof useSwipe>["handlers"];
  /** Whether the full-size copy may be put on the stage. */
  sharp: boolean;
  onClose: () => void;
  /** The frames before and after, shown at the edges; absent at the ends. */
  prev?: Frame;
  next?: Frame;
  onStep: (delta: number) => void;
  /** Where the frame is in the sequence: which way a step went. */
  index: number;
}) {
  /* Julian: a 3D card transition on a step. The new frame swings in from
     the side it was waiting at, turned as it was there (`.lightbox-side`),
     and lands flat. Not on the first frame: the trip brings that one. */
  const swung = React.useRef(index);
  React.useEffect(() => {
    const dir = Math.sign(index - swung.current);
    swung.current = index;
    const box = area.current?.querySelector<HTMLElement>("[data-zoom-box]");
    if (!box || !dir || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    box.animate(
      [
        {
          /* Julian: natural and smooth. From about where the side
             photograph waited, turned as it was, easing out long. */
          transform: `perspective(1400px) translateX(${dir * 40}%) rotateY(${dir * 20}deg) scale(0.88)`,
        },
        { transform: "none" },
      ],
      { duration: STEP_MS, easing: STEP_EASE },
    );
    /* And the two either side move with it, as one carousel (Julian: the
       swap was not smooth; they vanished and faded back). The one behind
       the step is the picture that was in the middle: it leaves the middle
       flat and turns into its place. The one ahead glides in from past the
       edge. */
    const stage = area.current?.getBoundingClientRect();
    for (const side of area.current?.querySelectorAll<HTMLElement>(".lightbox-side") ?? []) {
      if (!stage) break;
      const turn = getComputedStyle(side).getPropertyValue("--turn").trim() || "0deg";
      const at = (x: string, z: string, r: string) =>
        `perspective(1400px) translateX(${x}) translateZ(${z}) rotateY(${r})`;
      const rest = at("0px", "-160px", turn);
      const behind = (side.dataset.side === "prev") === dir > 0;
      if (behind) {
        const b = side.getBoundingClientRect();
        const dx = stage.left + stage.width / 2 - (b.left + b.width / 2);
        side.animate([{ transform: at(`${dx}px`, "0px", "0deg") }, { transform: rest }], {
          duration: STEP_MS,
          easing: STEP_EASE,
        });
      } else {
        side.animate(
          [{ transform: at(`${dir * 60}%`, "-160px", turn), opacity: 0 }, { transform: rest, opacity: 1 }],
          { duration: STEP_MS, easing: STEP_EASE },
        );
      }
    }
  }, [index]);
  /* Which full-size copy has painted. By source, so a step to the next
     frame starts from the fitted picture again until its own arrives. */
  const [sharpDone, setSharpDone] = React.useState<string | null>(null);
  /* Which picture has painted, for the orb: by source, as above. */
  const [shown, setShown] = React.useState<string | null>(null);
  const area = React.useRef<HTMLDivElement>(null);
  const size = useFit(area, frame.width, frame.height);
  const zoom = useZoom(pictureRef, frame.src, swipe);
  /* Under the picture while it arrives.
     The viewer asks for a wider copy than the strip did, so on a slow
     connection the file is still in flight when the trip starts — the
     press waits `DECODE_CAP_MS` and no longer. Measured on production:
     the box was empty for the first 400ms and the file landed at 641ms,
     which is the blank Julian saw. The copy the page already decoded is
     the same photograph and costs nothing, so it holds the box until the
     full one paints; the frame's own colour covers a frame that is not
     on the page, after a few arrow keys. */
  const under = React.useMemo(() => decodedCopy(frame.src), [frame.src]);
  return (
    <div
      ref={area}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4 sm:p-10"
    >
      {/* Julian: a thinking orb while the picture is still on its way.
          It waits a third of a second before it shows, so a picture that
          is already here never flashes one. */}
      {shown !== frame.src ? (
        <span className="orb-late pointer-events-none absolute bottom-4 right-4 z-10 text-foreground sm:bottom-6 sm:right-6">
          <Orb state="searching" size={20} />
        </span>
      ) : null}
      {/* What the finger moves. Stays mounted across a step, so the offset
          it was released at is where the next frame starts from. */}
      <div
        ref={pictureRef}
        data-ring={zoom.ring}
        {...zoom.pan}
        onClick={(e) => {
          if (zoom.dragged()) return;
          if (e.target === e.currentTarget) onClose();
        }}
        className="flex h-full w-full touch-none select-none items-center justify-center"
      >
        {/* The box the trip transforms: exactly the picture, clipped. */}
        <div
          data-zoom-box
          className={cn(
            // Over the neighbours tucked behind it.
            "relative z-20 shrink-0 bg-cover bg-center shadow-[0_30px_80px_-20px_rgb(0_0_0/0.45)]",
            /* Clipped at its own edge while it is the size it was fitted
               to, and not once a wheel has been over it: a zoom is
               allowed the whole viewer, which on an upright photograph
               is most of the window either side of the frame. The stage
               clips instead. Julian asked. */
            zoom.scale === 1 && "overflow-hidden",
          )}
          style={{
            ...(size ? { width: size.w, height: size.h } : { width: 0, height: 0 }),
            backgroundColor: zoom.scale === 1 ? frame.color : "transparent",
            ...(under && zoom.scale === 1
              ? { backgroundImage: `url("${under}")` }
              : null),
          }}
        >
          <div style={zoom.style} className="relative h-full w-full">
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
            onLoad={(e) => {
              paint(frame.src)(e);
              setShown(frame.src);
            }}
            className="block h-full w-full object-contain"
          />
          {/* The zoomable copy: the master's full width at 82, laid exactly
              over the fitted picture once it has decoded, so the swap is
              invisible until a wheel goes in on it. The fitted picture is
              screen sized, and at three times it was soft. */}
          {sharp ? (
            <Image
              key={`sharp-${frame.src}`}
              src={frame.src}
              alt=""
              aria-hidden
              width={frame.width}
              height={frame.height}
              sizes="2500px"
              quality={82}
              draggable={false}
              onLoad={() => setSharpDone(frame.src)}
              className={cn(
                "absolute inset-0 block h-full w-full object-contain",
                sharpDone === frame.src ? "opacity-100" : "opacity-0",
              )}
            />
          ) : null}
          </div>
        </div>
      </div>
      {/* Julian: the photograph before and the one after, at the picture's
          height, 24px off its edges and running off the window, blurred
          until the pointer is on one, which then says PREV or NEXT and
          steps there on a click. Julian: turned in 3D toward the picture,
          and tilting to the pointer as the Selected work tiles do. Not while zoomed, and not on a phone,
          where a swipe does it. Out of the tab order: the arrows below
          are the controls for that. They fade in on their own
          (`.lightbox-peek`), since one can arrive after a step. */}
      {size && zoom.scale === 1
        ? ([[-1, prev, "Prev"], [1, next, "Next"]] as const).map(([d, f, word]) => {
            if (!f) return null;
            /* Julian (2026-10-03): whole, never cropped, the 3D made
               elite, and not crowding the picture ("too close"). A cover
               flow: each neighbour smaller and set back, a clear gap from
               the picture, turned away from it on its inner edge, whole
               inside the window: shrunk to the room, gone below a
               sliver. */
            const GAP = 56;
            const vw = size.vw;
            const room = vw / 2 - size.w / 2 - GAP - 24;
            let h = size.h * 0.78;
            let w = (h * f.width) / f.height;
            const proj = () => w * 0.72; // its width on screen, turned
            if (proj() > room) {
              const k = room / proj();
              h *= k;
              w *= k;
            }
            if (room < 64) return null;
            return (
              <button
                key={word}
                type="button"
                tabIndex={-1}
                aria-label={d < 0 ? "Previous frame" : "Next frame"}
                data-ring={word}
                data-side={d < 0 ? "prev" : "next"}
                onClick={() => onStep(d)}
                className="lightbox-side absolute top-1/2 z-10 -translate-y-1/2 max-sm:hidden"
                style={{
                  width: Math.round(w),
                  height: Math.round(h),
                  [d < 0 ? "right" : "left"]: `calc(50% + ${Math.round(size.w / 2 + GAP)}px)`,
                } as React.CSSProperties}
              >
                <TiltedCard
                  imageSrc={f.src}
                  altText=""
                  containerHeight="100%"
                  imageHeight="100%"
                  imageWidth="100%"
                  scaleOnHover={1.04}
                  showMobileWarning={false}
                  showTooltip={false}
                >
                  {/* Not keyed: the card stays through a step and moves
                      (above). The picture is, so a new one is never the old
                      one for a frame, and the copy the page already has is
                      under it until it paints, as under the middle one.
                      Over it a pane of glass, the picture sharp under it
                      (`.lightbox-glass`). */}
                  <span
                    className="lightbox-peek relative block h-full w-full overflow-hidden bg-cover bg-center"
                    style={{ backgroundImage: sideUnder(f.src) }}
                  >
                    <Image
                      key={f.src}
                      src={f.src}
                      alt=""
                      aria-hidden
                      width={f.width}
                      height={f.height}
                      sizes="50vw"
                      onLoad={paint(f.src)}
                      draggable={false}
                      className="absolute inset-0 block h-full w-full object-cover"
                    />
                    <span aria-hidden className="lightbox-glass" />
                  </span>
                </TiltedCard>
              </button>
            );
          })
        : null}
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
      // The pointer sticks to it (`pointer-mark.tsx`).
      data-stick=""
      // 44px minimum target: the control someone taps repeatedly on a
      // phone gets a real hit area rather than an icon's worth.
      className="glass flex h-11 w-11 items-center justify-center text-base press active:scale-[0.97]"
    >
      <span aria-hidden>{children}</span>
    </button>
  );
}
