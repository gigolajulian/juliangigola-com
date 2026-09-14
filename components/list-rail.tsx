"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── how long the list is, and where you are in it ────────────────
 * A thin rail beside the work list, pinned with the cover. The thumb is
 * the part of the list on screen, in proportion, and it glides down the
 * rail as the page scrolls; a count rides beside it. Julian asked for a
 * visual indicator of the list's length, animated and interactive.
 *
 * Interactive two ways: press anywhere on the rail and the page goes to
 * that point in the list; hold and drag and it follows the pointer. The
 * count shows while the rail is under the pointer, held, or the list
 * has just moved, and fades the rest of the time.
 *
 * Pointer only, and said so: the page's own scrolling and the rows'
 * focus order are the keyboard and screen-reader path through the same
 * list, so this is hidden from assistive technology rather than given
 * a second, weaker keyboard model.
 * ─────────────────────────────────────────────────────────────── */

/* Where the list is showing through the window, in one place: the rail is
   pinned where the list starts, so the part on screen runs from the rail's
   top to the foot of the window. Outside the component because it closes
   over nothing — which is also why it needs no memoizing. */
function geometry(el: HTMLElement, rail: HTMLElement) {
  const box = rail.getBoundingClientRect();
  const listTop = el.getBoundingClientRect().top + window.scrollY;
  const shown = window.innerHeight - box.top;
  return {
    listTop,
    shown,
    travel: Math.max(0, el.offsetHeight - shown),
    railTop: box.top,
    railH: box.height,
    listH: el.offsetHeight,
  };
}

export function ListRail({
  list,
  count,
  className,
}: {
  /** The element the rail measures: the list, or the column holding it. */
  list: React.RefObject<HTMLElement | null>;
  count: number;
  className?: string;
}) {
  const rail = React.useRef<HTMLDivElement>(null);
  // Thumb geometry in pixels, and progress 0..1 for the count.
  const [thumb, setThumb] = React.useState({ y: 0, h: 0, p: 0 });
  const [over, setOver] = React.useState(false);
  const [held, setHeld] = React.useState(false);
  const [moving, setMoving] = React.useState(false);
  const still = React.useRef(0);

  React.useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!list.current || !rail.current) return;
      const g = geometry(list.current, rail.current);
      const p =
        g.travel === 0
          ? 0
          : Math.min(1, Math.max(0, (window.scrollY - (g.listTop - g.railTop)) / g.travel));
      const h = Math.max(32, Math.min(g.railH, (g.shown / g.listH) * g.railH));
      setThumb({ y: p * (g.railH - h), h, p });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
      setMoving(true);
      window.clearTimeout(still.current);
      still.current = window.setTimeout(() => setMoving(false), 700);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", update);
      if (frame) cancelAnimationFrame(frame);
      window.clearTimeout(still.current);
    };
  }, [list, count]);

  /* A press goes to that point in the list; a drag follows the pointer. */
  const go = (clientY: number) => {
    if (!list.current || !rail.current) return;
    const g = geometry(list.current, rail.current);
    if (g.railH === 0) return;
    const f = Math.min(1, Math.max(0, (clientY - g.railTop) / g.railH));
    window.scrollTo({ top: g.listTop - g.railTop + f * g.travel });
  };

  const awake = over || held || moving;
  const at = Math.min(count, Math.round(thumb.p * (count - 1)) + 1);

  return (
    <div
      ref={rail}
      aria-hidden
      onPointerEnter={() => setOver(true)}
      onPointerLeave={() => setOver(false)}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setHeld(true);
        go(e.clientY);
      }}
      onPointerMove={(e) => held && go(e.clientY)}
      onPointerUp={() => setHeld(false)}
      onPointerCancel={() => setHeld(false)}
      className={cn(
        "relative w-6 shrink-0 cursor-pointer touch-none select-none",
        className,
      )}
    >
      {/* The track: the whole list. */}
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-full bg-foreground/10",
          "transition-[width] duration-200 ease-[var(--ease-out-strong)]",
          awake && "w-[3px]",
        )}
      />
      {/* The thumb: the part of it on screen. */}
      <div
        className={cn(
          "absolute left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-foreground/35",
          "transition-[transform,height,width,background-color] duration-150 ease-[var(--ease-out-strong)] motion-reduce:transition-none",
          awake && "w-[5px] bg-foreground/70",
          held && "transition-none",
        )}
        style={{ height: thumb.h, transform: `translate(-50%, ${thumb.y}px)` }}
      >
        {/* The count, beside the thumb. */}
        <span
          className={cn(
            "label absolute right-3 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-background px-1.5 py-0.5 text-muted-foreground",
            "transition-opacity duration-200 ease-[var(--ease-out-strong)]",
            awake ? "opacity-100" : "opacity-0",
          )}
        >
          {at} / {count}
        </span>
      </div>
    </div>
  );
}
