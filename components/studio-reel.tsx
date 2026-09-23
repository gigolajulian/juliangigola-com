"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* ── the reel beside the writing ──────────────────────────────────
 * The studio page showed one photograph, pinned beside the biography for
 * the whole scroll. Julian asked for a carousel of five to eight shoots
 * instead, so somebody reading about how a commission runs is looking at
 * six of them rather than the same frame for four sections.
 *
 * A crossfade rather than a strip: the slot is a narrow pinned column, so
 * there is nowhere to scroll sideways, and the frames are different shapes.
 * One box, one shape, the pictures changing inside it.
 *
 * It turns itself over, and stops the moment a pointer or a focus ring
 * arrives — a picture must not change under somebody who is deciding
 * whether to click it. Reduced motion holds the first frame and leaves the
 * ticks as the way through.
 * ─────────────────────────────────────────────────────────────── */

export type Shoot = {
  href: string;
  name: string;
  src: string;
  alt: string;
  color?: string;
};

const DWELL_MS = 4600;

export function StudioReel({
  shoots,
  className,
  /** Fill the column instead of holding 4:5, with the caption over the
      foot of the picture. The studio page's opening screen gives it half
      a window and the picture takes all of it. */
  fill = false,
}: {
  shoots: Shoot[];
  className?: string;
  fill?: boolean;
}) {
  const [at, setAt] = React.useState(0);
  const [held, setHeld] = React.useState(false);

  React.useEffect(() => {
    if (held || shoots.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(
      () => setAt((i) => (i + 1) % shoots.length),
      DWELL_MS,
    );
    return () => window.clearTimeout(t);
  }, [at, held, shoots.length]);

  const here = shoots[at];
  if (!here) return null;

  return (
    <div
      className={cn("flex min-h-0 flex-col", className)}
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      {/* One shape for the set. The frames are a mix of portraits and
          squares, and a box that resized with each one would move the
          words beside it every few seconds. Along the strip the height is
          the strip's and 4:5 decides the width. */}
      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-hidden",
          !fill && "aspect-[4/5]",
        )}
      >
        {shoots.map((shoot, i) => (
          <Link
            key={shoot.href}
            href={shoot.href}
            aria-hidden={i !== at}
            tabIndex={i === at ? undefined : -1}
            data-ring="View project"
            style={{ backgroundColor: shoot.color }}
            className={cn(
              "press absolute inset-0 block transition-opacity duration-700 ease-[var(--ease-out-strong)] active:scale-[0.995] motion-reduce:transition-none",
              i === at ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <Image
              src={shoot.src}
              alt={shoot.alt}
              fill
              sizes={
                fill
                  ? "(min-width: 640px) 50vw, 100vw"
                  : "(min-width: 640px) 35vw, 100vw"
              }
              priority={i === 0}
              className={cn(
                "h-full w-full object-cover",
                // A shade above the middle where the picture is filling a
                // column: a frame shot upright and cropped to a wider box
                // loses the head first, and the head is the picture.
                fill && "object-[50%_35%]",
              )}
            />
          </Link>
        ))}
        {fill ? (
          <Caption here={here} shoots={shoots} at={at} setAt={setAt} fill />
        ) : null}
      </div>

      {fill ? null : (
        <Caption here={here} shoots={shoots} at={at} setAt={setAt} />
      )}
    </div>
  );
}

/* Whose it is on the left, the way through on the right. The ticks are the
   same instrument the project pages use under the strip. Under the picture
   where the reel is a column beside the words, and over the foot of it
   where the reel is the whole column. */
function Caption({
  here,
  shoots,
  at,
  setAt,
  fill = false,
}: {
  here: Shoot;
  shoots: Shoot[];
  at: number;
  setAt: (i: number) => void;
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-end justify-between gap-6",
        fill
          ? "absolute inset-x-0 bottom-0 z-10 glass-surface bg-background/70 px-5 py-4"
          : "mt-4",
      )}
    >
      <p className="label min-w-0 truncate">{here.name}</p>

      <div className="flex shrink-0 items-end gap-1.5">
        {shoots.map((shoot, i) => (
          <button
            key={shoot.href}
            type="button"
            onClick={() => setAt(i)}
            aria-label={shoot.name}
            aria-current={i === at}
            // 24px square, which is the floor for something you have to
            // hit; the mark inside stays the size it was.
            className="group flex h-6 w-6 items-end justify-center"
          >
            <span
              className={cn(
                "block w-5 rounded-full transition-[height,background-color] duration-200 ease-[var(--ease-out-strong)]",
                i === at
                  ? "h-2.5 bg-foreground"
                  : "h-1 bg-foreground/20 hoverable:group-hover:bg-foreground/50",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
