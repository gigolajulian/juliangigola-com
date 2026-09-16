"use client";

import { ViewTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import type { IndexRow } from "@/lib/work";

/* ── a cover, as a cell of the work strip ─────────────────────────
 * One project: its opening frame at the strip's full height, its name and
 * its credit on a plate along the foot. A press opens the project, and the
 * cover morphs into the first frame of the sequence there: the same
 * `cover-${slug}` name the homepage tiles carry, so the picture a visitor
 * chose is the picture that arrives.
 *
 * A client component for the one reason that `ViewTransition` needs one;
 * what it is handed is an `IndexRow`, not a `Project`, so the payload stays
 * a name and a picture per cell (see `indexRow` in `lib/work.ts`).
 *
 * No prefetch. Next prefetches every link that scrolls into view, and the
 * work strip has fifty-five: one visitor wheeling along it cost ~55 Worker
 * requests before they clicked anything, on a plan capped at a hundred
 * thousand a day, which the site hit (Cloudflare error 1027). A cover
 * fetches on click instead, which the morph covers.
 * ─────────────────────────────────────────────────────────────── */

export function CoverCell({
  row,
  href,
  label,
  hash,
  i,
  mark,
  eager,
}: {
  row: IndexRow;
  /** Where the cell goes; the project by default. A discipline that is one
      gallery (Cover art, Automotive) sends its cell to its category page. */
  href?: string;
  /** The word for the running head and the tick; only for cells that
      stand for a whole discipline. */
  label?: string;
  hash?: string;
  /** Its place in the strip, for the stagger of the arrival. */
  i: number;
  /** The slug of the client's mark, shown in the panel while this cell is
      the one in the middle. */
  mark?: string;
  /** The first screen's covers load with the page; the rest as the strip
      reaches them. */
  eager?: boolean;
}) {
  return (
    <Link
      prefetch={false}
      href={href ?? `/work/${row.slug}`}
      data-tick
      data-label={label}
      data-hash={hash}
      data-ring="View project"
      data-mark={mark}
      className="group strip-cell relative block w-full shrink-0 overflow-hidden press active:scale-[0.995] sm:h-full sm:w-auto"
      style={
        {
          backgroundColor: row.cover.color,
          aspectRatio: `${row.cover.width} / ${row.cover.height}`,
          "--i": i,
        } as React.CSSProperties
      }
    >
      <ViewTransition name={`cover-${row.slug}`} share="morph" default="none">
        <Image
          data-fade=""
          src={row.cover.src}
          alt={row.cover.alt || row.name}
          fill
          sizes="(min-width: 640px) 35vw, 100vw"
          priority={eager}
          loading={eager ? undefined : "lazy"}
          placeholder={row.cover.blur ? "blur" : "empty"}
          blurDataURL={row.cover.blur}
          draggable={false}
          className="strip-frame object-cover"
        />
      </ViewTransition>

      {/* The plate: the same material as the bar at the top of every page,
          the height of its own two lines and no more, so it covers what it
          needs to of the photograph and nothing else. Always on, because a
          strip of covers is scanned for a name you recognise. */}
      <div className="cover-plate pointer-events-none absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-4 border-t border-border/60 glass-surface bg-background/70 px-4 py-3">
        <span className="font-display min-w-0 truncate text-lg uppercase leading-none tracking-[0]">
          {row.name}
        </span>
        <span className="label shrink-0 text-muted-foreground">
          {row.credit}
          {/* And how much of it there is. A cover is one photograph; the
              number is what says it opens onto a body of work. Off on a
              phone, where the plate is 390px wide and the name is what has
              to survive. */}
          {row.frames ? (
            <span className="max-sm:hidden">
              <span className="px-1.5 text-muted-foreground/50">/</span>
              {row.frames} frames
            </span>
          ) : null}
        </span>
      </div>
    </Link>
  );
}
