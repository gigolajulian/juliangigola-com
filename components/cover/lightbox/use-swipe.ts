import * as React from "react";
import { rubberband } from "@/lib/motion/rubberband";

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

export function useSwipe({ onStep, onDismiss }: { onStep: (delta: 1 | -1) => void; onDismiss: () => void }) {
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

  const place = (x: number, y: number, scale: number, opacity: number, settle: boolean) => {
    const el = ref.current;
    if (!el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.style.transition = settle && !still ? "transform 360ms var(--ease-spring), opacity 200ms var(--ease-out-strong)" : "none";
    el.style.transform = x || y || scale !== 1 ? `translate(${x}px, ${y}px) scale(${scale})` : "";
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
      const commit = Math.abs(dx) > el.clientWidth * 0.3 || Math.abs(vx) > FLICK;
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

  /* A cancel (a system gesture, or the second finger of a pinch) only snaps
     back: it never steps or closes, wherever the finger was. Any pointer, so
     the pinch's second finger lets go of the first one's drag. */
  const onPointerCancel: React.PointerEventHandler<HTMLDivElement> = () => {
    if (!drag.current) return;
    drag.current = null;
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
      onPointerCancel,
      onClickCapture,
    },
  };
}

/** The pointer handlers a swipe hands the picture. */
export type SwipeHandlers = ReturnType<typeof useSwipe>["handlers"];
