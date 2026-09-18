"use client";

import * as React from "react";
import { createPortal, flushSync } from "react-dom";
import loader from "../image-loader";
import { rubberband } from "@/lib/utils";
import {
  zoomOpen,
  zoomClose,
  lockScroll,
  pushHistory,
  DECODE_CAP_MS,
  type ZoomTrip,
} from "@/lib/zoom";

/* ── the zoom, on a plain grid ────────────────────────────────────
 * A test bed for `lib/zoom.ts`: rounded thumbnails cropped to cells of
 * mixed shapes and sizes, a panorama and a very tall portrait among them,
 * a grid long enough to scroll, and a viewer with nothing in it but what
 * the module needs. Not linked from the site and not indexed.
 * ─────────────────────────────────────────────────────────────── */

type Pic = { src: string; w: number; h: number; cell: string; label: string };

const PICS: Pic[] = [
  { src: "/work/places/14.jpg", w: 2499, h: 1405, cell: "aspect-[3/1] col-span-2", label: "panorama in a 3:1 cell" },
  { src: "/work/realestate/09.jpg", w: 2367, h: 3737, cell: "aspect-[1/2] row-span-2", label: "tall portrait in a 1:2 cell" },
  { src: "/work/hua/01.jpg", w: 2500, h: 3333, cell: "aspect-square", label: "portrait in a square cell" },
  { src: "/work/hua/02.jpg", w: 2500, h: 1563, cell: "aspect-[4/3]", label: "landscape in a 4:3 cell" },
  { src: "/work/places/07.jpg", w: 2499, h: 1311, cell: "aspect-[3/4]", label: "landscape in a 3:4 cell" },
  { src: "/work/lost-relic/01.jpg", w: 2500, h: 3333, cell: "aspect-[3/4] col-span-2", label: "portrait in a wide 3:4 cell" },
  { src: "/work/frostbite/12.jpg", w: 2074, h: 3129, cell: "aspect-square", label: "tall portrait in a square cell" },
  { src: "/work/realestate/02.jpg", w: 2499, h: 1386, cell: "aspect-[16/9] col-span-2", label: "landscape in a 16:9 cell" },
  { src: "/work/automotive/03.jpg", w: 2429, h: 3641, cell: "aspect-[2/3]", label: "portrait in a 2:3 cell" },
];

/** Three rounds of the nine, so the grid scrolls well past the window. */
const GRID = [0, 1, 2].flatMap((round) =>
  PICS.map((p, i) => ({ ...p, id: `${round}-${i}` })),
);

const thumb = (p: Pic) => loader({ src: p.src, width: 640 });
const full = (p: Pic) => loader({ src: p.src, width: 2500 });

export function ZoomDemo() {
  const [open, setOpen] = React.useState<number | null>(null);
  const trip = React.useRef<ZoomTrip | null>(null);
  const closing = React.useRef(false);
  const pending = React.useRef(false);
  const unlock = React.useRef<(() => void) | null>(null);
  const unpush = React.useRef<(() => void) | null>(null);
  const opener = React.useRef<HTMLElement | null>(null);
  const stage = React.useRef<HTMLDivElement>(null);
  const box = React.useRef<HTMLDivElement>(null);
  const backdrop = React.useRef<HTMLDivElement>(null);
  const closeBtn = React.useRef<HTMLButtonElement>(null);
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

  const cellOf = (id: string) =>
    document.querySelector<HTMLElement>(`[data-cell="${id}"]`);
  const chrome = () =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-demo-chrome]"));

  /* The box is exactly the picture at the largest size the stage allows,
     computed here so the trip's transform is of the picture and nothing
     else. */
  const fit = React.useCallback((i: number) => {
    const el = stage.current;
    if (!el) return;
    const p = GRID[i];
    const s = Math.min(el.clientWidth / p.w, el.clientHeight / p.h);
    setSize({ w: Math.round(p.w * s), h: Math.round(p.h * s) });
  }, []);
  React.useLayoutEffect(() => {
    if (open === null || !stage.current) return;
    fit(open);
    const ro = new ResizeObserver(() => fit(open));
    ro.observe(stage.current);
    return () => ro.disconnect();
  }, [open, fit]);

  const close = React.useCallback(() => {
    if (pending.current) {
      pending.current = false;
      return;
    }
    if (open === null || closing.current) return;
    closing.current = true;
    unlock.current?.();
    unlock.current = null;
    const b = box.current;
    const dragged = b?.parentElement?.style.transform;
    const startRect =
      trip.current?.interrupt() ??
      (dragged && b ? b.getBoundingClientRect() : null);
    trip.current = zoomClose({
      box: b,
      picture: b?.querySelector("img") ?? null,
      to: cellOf(GRID[open].id),
      startRect,
      backdrop: () => backdrop.current,
      chrome,
      unmount: () => flushSync(() => setOpen(null)),
    });
    trip.current.finished.finally(() => {
      unpush.current?.();
      unpush.current = null;
      trip.current = null;
      closing.current = false;
      opener.current?.focus({ preventScroll: true });
    });
  }, [open]);
  const closeRef = React.useRef(close);
  React.useEffect(() => {
    closeRef.current = close;
  });

  const show = (i: number, from: HTMLElement) => {
    if (open !== null || trip.current) return;
    opener.current = from;
    pending.current = true;
    // The full picture, decoded first, capped.
    const warm = new window.Image();
    warm.src = full(GRID[i]);
    void Promise.race([
      warm.decode().catch(() => {}),
      new Promise<void>((r) => window.setTimeout(r, DECODE_CAP_MS)),
    ]).then(() => {
      if (!pending.current) return;
      pending.current = false;
      unlock.current = lockScroll();
      trip.current = zoomOpen({
        from,
        mount: () => flushSync(() => setOpen(i)),
        box: () => box.current,
        picture: () => box.current?.querySelector("img") ?? null,
        backdrop: () => backdrop.current,
        chrome,
      });
      trip.current.finished.finally(() => {
        if (!closing.current) trip.current = null;
        closeBtn.current?.focus({ preventScroll: true });
      });
      unpush.current = pushHistory(() => closeRef.current());
    });
  };

  const step = (d: 1 | -1) =>
    setOpen((i) => (i === null ? i : (i + d + GRID.length) % GRID.length));

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (open === null) return;
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const { ref: dragRef, handlers: drag } = useDrag(() => closeRef.current());
  const p = open === null ? null : GRID[open];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl uppercase">Zoom test bed</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Rounded, cropped thumbnails of every shape. Click one; close with the
        button, Escape, a click outside, the back button, or by dragging down.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GRID.map((g, i) => (
          <button
            key={g.id}
            type="button"
            data-cell={g.id}
            aria-label={`Open ${g.label}`}
            onClick={(e) => show(i, e.currentTarget)}
            className={`block w-full overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-2 focus-visible:ring-foreground ${g.cell}`}
          >
            {/* Plain images on purpose: the test bed is about the trip. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb(g)}
              alt=""
              loading="lazy"
              className="block h-full w-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* On the body, like the site's own viewer: an ancestor with a
          transform or containment would otherwise make `fixed` mean
          "inside me". */}
      {p ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={p.label}
          className="fixed inset-0 z-50 flex flex-col"
        >
          <div
            ref={backdrop}
            onClick={close}
            className="absolute inset-0 bg-background/95"
            style={{ opacity: 0 }}
          />
          <div
            ref={stage}
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
            className="relative flex min-h-0 flex-1 items-center justify-center p-6 sm:p-12"
          >
            <div
              ref={dragRef}
              {...drag}
              className="flex h-full w-full touch-none select-none items-center justify-center"
              onClick={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              <div
                ref={box}
                className="relative shrink-0 overflow-hidden"
                style={size ? { width: size.w, height: size.h } : { width: 0, height: 0 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={p.src}
                  src={full(p)}
                  alt={p.label}
                  draggable={false}
                  className="block h-full w-full object-contain"
                />
              </div>
            </div>
          </div>
          <div className="relative flex shrink-0 items-center justify-between gap-6 px-6 pb-6">
            <p
              data-demo-chrome
              aria-live="polite"
              className="label text-muted-foreground"
              style={{ opacity: 0 }}
            >
              {(open ?? 0) + 1} / {GRID.length} · {p.label}
            </p>
            <div data-demo-chrome className="flex gap-2" style={{ opacity: 0 }}>
              <button type="button" onClick={() => step(-1)} className="label glass px-4 py-2.5" aria-label="Previous">←</button>
              <button type="button" onClick={() => step(1)} className="label glass px-4 py-2.5" aria-label="Next">→</button>
              <button ref={closeBtn} type="button" onClick={close} className="label glass ml-4 px-4 py-2.5">Close</button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

/* Drag to dismiss, any pointer here so it can be driven by a mouse in a
   test: down scales and fades the picture with the distance, a release
   past a quarter of the height or a flick closes from where it is, and
   anything less springs back. */
function useDrag(onDismiss: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);
  const d = React.useRef<{ id: number; y0: number; t0: number; y: number } | null>(null);
  const moved = React.useRef(false);
  const place = (y: number, settle: boolean) => {
    const el = ref.current;
    if (!el) return;
    const share = Math.max(0, y) / el.clientHeight;
    el.style.transition = settle
      ? "transform 360ms var(--ease-spring), opacity 200ms var(--ease-out-strong)"
      : "none";
    el.style.transform = y ? `translate(0px, ${y > 0 ? y : rubberband(y, el.clientHeight)}px) scale(${1 - 0.4 * Math.min(1, share)})` : "";
    el.style.opacity = y > 0 ? String(Math.max(0.3, 1 - share)) : "";
  };
  return {
    ref,
    handlers: {
      onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
        if (!e.isPrimary || e.button !== 0) return;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {}
        d.current = { id: e.pointerId, y0: e.clientY, t0: e.timeStamp, y: 0 };
        moved.current = false;
        place(0, false);
      },
      onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
        if (!d.current || e.pointerId !== d.current.id) return;
        const y = e.clientY - d.current.y0;
        if (!moved.current && Math.abs(y) < 10) return;
        moved.current = true;
        d.current.y = y;
        place(y, false);
      },
      onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
        const g = d.current;
        if (!g || e.pointerId !== g.id) return;
        d.current = null;
        const el = e.currentTarget;
        const v = g.y / Math.max(1, e.timeStamp - g.t0);
        if (g.y > el.clientHeight * 0.25 || v > 0.11) onDismiss();
        else place(0, true);
      },
      onClickCapture: (e: React.MouseEvent) => {
        if (moved.current) {
          e.stopPropagation();
          moved.current = false;
        }
      },
    },
  };
}
