import * as React from "react";
import type { SwipeHandlers } from "./use-swipe";

/* ── scroll to zoom, drag to look around ──────────────────────────
 * A wheel over the picture zooms it, up to three times in and never
 * smaller than it arrived: fitted to the window is the photograph, and
 * anything under that is a picture sitting in a hole. The point under
 * the pointer stays where it is, so zooming towards a face grows the
 * face and not the middle of the frame, and past fit the hand moves it
 * with the offset held to the overhang, so it cannot be dragged away.
 *
 * The transform goes on a wrapper of its own, between the box and the
 * picture. `components/cover/zoom.ts` flies the box and animates the picture inside it,
 * and a finished Web Animation holds whatever transform it ended on, so a
 * zoom written to either of them is set and then ignored. Measured before
 * the wrapper: scale 1.9 in state, matrix(1, 0, 0, 1, 0, 0) on screen.
 * ─────────────────────────────────────────────────────────────── */
const ZOOM_MIN = 1;
const ZOOM_MAX = 3;

export function useZoom(
  box: React.RefObject<HTMLDivElement | null>,
  key: string,
  swipe: SwipeHandlers,
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
       cursor says whether there is anything to drag. One word (Julian's
       call): VIEW, DRAG, ZOOM, SCROLL. */
    ring: "Scroll",
    style: {
      transform: `translate(${at.x}px, ${at.y}px) scale(${scale})`,
      transition: held ? "none" : "transform 180ms var(--ease-out-strong)",
      cursor: scale > 1 ? (held ? "grabbing" : "grab") : undefined,
    } as React.CSSProperties,
  };
}
