"use client";

import * as React from "react";
import { ViewTransition } from "react";
import { useRouter } from "next/navigation";
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
      () => router.prefetch(href ?? `/work/${row.slug}`),
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
        href={href ?? `/work/${row.slug}`}
        data-tick
        data-label={label}
        /* The chapter is `data-label` and only the first cover of a
           discipline carries one. This is the project, on every cover, so
           the ruler can name the one under the pointer rather than naming
           the chapter eight times over. */
        data-name={row.name}
        data-hash={hash}
        data-ring="View project"
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
          placeholder={row.cover.blur ? "blur" : "empty"}
          blurDataURL={row.cover.blur}
          draggable={false}
          /* Under a pointer the photograph leans in. 1.04 and 500ms: a
             cover is a large surface and a fast scale on one reads as a
             jolt, where a slow one reads as the frame taking a step
             towards you. Transform only, so it stays on the compositor.
             The easing is on `img[data-fade]` in globals.css, which is an
             element-and-attribute selector and beats a class: a
             `transition-[scale]` written here lost to it and the picture
             jumped to size.
             Julian asked. */
          /* The same half second and the same ease as the plate below it,
             so the picture and its caption read as one answer to the
             pointer rather than two. */
          className="strip-frame object-cover transition-transform duration-500 ease-[var(--ease-out-strong)] hoverable:group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />

        {/* The plate: the same material as the bar at the top of every page,
          and two fifteenths of the cover: the fifth Julian first asked for,
          a third smaller when he asked again. One
          layout at every size — name along the bottom left, credit along
          the bottom right — with the type measured in `cqw` off the cell,
          so the rack and a phone held sideways get the same plate as a
          full window rather than a stacked variant of their own. Always
          on, because a strip of covers is scanned for a name. */}
        <div className="cover-plate pointer-events-none absolute -inset-x-0.5 -bottom-0.5 flex h-[13.333%] min-h-[1.8333rem] flex-col justify-center gap-[0.8cqw] glass-surface bg-background/70 px-[4cqw] transition-[background-color] duration-500 ease-[var(--ease-out-strong)] hoverable:group-hover:bg-background/40 motion-reduce:transition-none">
          <span
            style={{ "--n": row.name.length } as React.CSSProperties}
            className="cover-name font-display min-w-0 truncate uppercase leading-[0.9] tracking-[0]"
          >
            {row.name}
          </span>
          {/* Under the name, not beside it. Julian asked: who it was for
            reads as a subtitle to the title and not as a second column
            competing with it, and the whole plate ranges left off one
            edge. The count is what says a cover opens onto a body of
            work rather than being one photograph. */}
          <span className="label min-w-0 truncate text-[clamp(0.6875rem,1.5cqw,0.75rem)] leading-none text-muted-foreground">
            {row.credit}
            {row.frames ? (
              <>
                <span className="px-1.5 text-muted-foreground/50">/</span>
                {row.frames} frames
              </>
            ) : null}
          </span>
        </div>
      </Link>
    </ViewTransition>
  );
}
