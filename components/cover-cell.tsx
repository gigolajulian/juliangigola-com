"use client";

import * as React from "react";
import { ViewTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { IndexRow } from "@/lib/work";
import ACCENTS from "@/lib/accents.json";

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
  const router = useRouter();
  /* Under the pointer, before the press: the project's page, and the
     frame its first cell opens on, at the size that cell would ask for.
     Measured on a recording, a cover pressed cold sat still for half a
     second before anything moved, because nothing about the project had
     been fetched: `prefetch={false}` here means never, by Julian's rule
     against the viewport prefetch flood, and a hover is one link at a
     time. `sources.json` says which full-size frame the cover is. */
  /* Julian: an index page loads its covers and nothing else, and the
     rest of a set only once the project is opened. So this warms the
     route and no longer fetches the project's first frame at up to
     2500px — which, with the pointer parked while the strip moved
     underneath it, was one full-size photograph per cover that slid
     past, and is what made scrolling with a pointer over the pictures
     stutter.

     Held for a beat first, for the same reason: covers travelling under
     a still pointer each fire this, and a prefetch per cover crossed is
     the viewport flood arriving sideways. A pointer that rests on one
     cover is somebody choosing it. */
  const hold = React.useRef(0);
  const warm = () => {
    window.clearTimeout(hold.current);
    hold.current = window.setTimeout(
      () => router.prefetch(href ?? `/portfolio/${row.slug}`),
      140,
    );
  };
  const cool = () => window.clearTimeout(hold.current);
  React.useEffect(() => () => window.clearTimeout(hold.current), []);
  /* The name is on the cell and not on the picture: the picture stands
     at scale(1.1) inside the cell's clip (`strip-frame`), and a snapshot
     of it is the picture unclipped, a tenth too big, which held for the
     whole trip and snapped down to size when the trip ended. Recorded on
     production as a step of 8% in brightness at the end of every open.
     The cell is the box the eye sees. */
  return (
    <ViewTransition name={`cover-${row.slug}`} share="morph" default="none">
      <Link
        prefetch={false}
        href={href ?? `/portfolio/${row.slug}`}
        /* What carries a cover's name, for `globals.css` to unname on a
           deal (`[data-morph]`). */
        data-morph=""
        data-tick
        data-label={label}
        /* The chapter is `data-label` and only the first cover of a
           discipline carries one. This is the project, on every cover, so
           the ruler can name the one under the pointer rather than naming
           the chapter eight times over. */
        data-name={row.name}
        /* The project's colour, for the rail (`scripts/make-accents.mjs`). */
        data-tint={(ACCENTS as Record<string, string>)[row.slug]}
        data-vt={row.slug}
        data-hash={hash}
        data-ring="View"
        data-mark={mark}
        onPointerEnter={warm}
        onPointerLeave={cool}
        onFocus={warm}
        onBlur={cool}
        className="group strip-cell relative block w-full shrink-0 overflow-hidden press active:scale-[0.995] sm:h-full sm:w-auto"
        style={
          {
            backgroundColor: row.cover.color,
            aspectRatio: `${row.cover.width} / ${row.cover.height}`,
            "--i": i,
          } as React.CSSProperties
        }
      >
        <Image
          data-fade=""
          src={row.cover.src}
          alt={row.cover.alt || row.name}
          fill
          // Height-bound above a phone: the cell is the strip's height and
          // the cover's ratio wide, so the width is told from the height.
          // 10rem is the bar, the chip row and the ruler. On a 3x screen,
          // two thirds, for the 2x rung (see `project-strip.tsx`).
          sizes={`(min-width: 640px) and (min-resolution: 2.5dppx) calc((100vh - 10rem) * ${((row.cover.width / row.cover.height) * 0.667).toFixed(3)}), (min-width: 640px) calc((100vh - 10rem) * ${(row.cover.width / row.cover.height).toFixed(3)}), 100vw`}
          priority={eager}
          loading={eager ? undefined : "lazy"}
          /* No blur placeholder: Next paints it as the picture's own
             background, and the picture is transparent until it lands
             (`data-fade`), so it was never seen. It still cost a small SVG
             document with a 20px blur for every cover, parsed and laid out
             as the page came in (116 on /work). The cell's own colour
             stands in. */
          draggable={false}
          /* No zoom under the pointer (Julian, 2026-10-04: none anywhere). */
          className="strip-frame object-cover transition-transform duration-500 ease-[var(--ease-out-strong)] motion-reduce:transition-none"
        />

        {/* Julian (2026-10-03): the films' slate on every project. No
          plate: the name large in the display face over a fall of shadow
          at the foot of the photograph, who it was for above it, both on
          the left. The name is sized to its length (`.cover-name`), so a
          long title stays on one line. */}
        <div className="cover-slate pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-[1.2cqw] bg-gradient-to-t from-black/80 via-black/35 to-transparent px-[5cqw] pb-[4.5cqw] pt-[16cqw]">
          <span className="label min-w-0 max-w-full truncate text-[clamp(0.625rem,1.6cqw,0.75rem)] leading-none text-white/75">
            {row.credit}
            {row.frames ? (
              <>
                <span className="px-1.5 text-white/45">/</span>
                {row.frames} frames
              </>
            ) : null}
          </span>
          <span
            style={{ "--n": row.name.length, "--w": Math.max(...row.name.split(" ").map((w) => w.length)) } as React.CSSProperties}
            className="cover-name font-display min-w-0 max-w-full truncate uppercase leading-[0.9] text-white"
          >
            {row.name}
          </span>
        </div>
      </Link>
    </ViewTransition>
  );
}
