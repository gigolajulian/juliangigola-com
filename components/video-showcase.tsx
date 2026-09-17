"use client";

import * as React from "react";
import Link from "next/link";
import { Strip, StripView, type Lead } from "@/components/strip";
import { VideoGrid } from "@/components/video-grid";
import { VideoViewer } from "@/components/video-viewer";
import { REEL, filmCount, type Video } from "@/lib/videos";

/* ── the films, along the strip, with one viewer over them ────────
 * The page is a server component; the viewer is state. This is the client
 * half that holds which film is open, so every section's tiles open into
 * the same viewer and the row under the player can offer every film on
 * the page, not only its own section's.
 *
 * It renders the strip itself rather than handing cells up: the strip
 * reads its cells as direct children, and a fragment of cells from a
 * component would be one child to it and many to the DOM.
 * ─────────────────────────────────────────────────────────────── */

export function VideoShowcase({
  sections,
  next,
  ask,
}: {
  sections: { id: string; name: string; films: Video[] }[];
  /** Where the wheel goes past the ask. */
  next?: Lead;
  /** The last cell, an `EnquiryCell`. */
  ask: React.ReactNode;
}) {
  const [open, setOpen] = React.useState<Video | null>(null);
  const all = sections.flatMap((s) => s.films);

  /* The reel is the page's ground, not its first cell: it plays full bleed
     behind everything (`ReelBackdrop` below), and the strip opens straight
     on the films. Julian asked for the reel as the background with the
     projects over it. */
  const cells: React.ReactNode[] = [];

  if (!all.length) {
    cells.push(
      /* Not an error state and not a placeholder pretending to be work.
         Until a link is pasted into /admin the page says so plainly and
         sends the visitor to the stills. */
      <div
        key="none"
        className="flex w-full shrink-0 flex-col justify-center py-10 sm:h-full sm:w-[min(28rem,70vw)] sm:py-0 sm:pl-10"
      >
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          The rest of the moving work is not up here yet.{" "}
          <Link
            href="/contact"
            className="text-foreground underline decoration-border underline-offset-4 hoverable:hover:decoration-foreground"
          >
            Ask for more
          </Link>{" "}
          and I&rsquo;ll reply within 24 hours.
        </p>
      </div>,
    );
  }

  for (const section of sections) {
    // A section with nothing in it is left out rather than drawn empty: a
    // heading over blank space reads as something failing to load.
    if (!section.films.length) continue;
    cells.push(
      <div
        key={`${section.id}-head`}
        data-tick
        data-label={section.name}
        data-hash={section.id}
        /* The column is at least 18rem and as much more as the word needs.
           A fixed 18rem is 248px of room once the gutter is taken, and
           COMMERCIAL set in the display face at 48px is 285px: the word ran
           out of its own cell and printed itself over the films standing
           next to it. Nothing here is long enough to want a cap. */
        className="flex w-full shrink-0 flex-col justify-center gap-2 py-10 sm:h-full sm:w-max sm:min-w-[min(18rem,40vw)] sm:py-0 sm:pl-10 sm:pr-10"
      >
        <h2 className="font-display text-3xl uppercase leading-[0.95] tracking-[0] sm:text-5xl">
          {section.name}
        </h2>
        <p className="label text-muted-foreground">
          {section.films.length}{" "}
          {section.films.length === 1 ? "film" : "films"}
        </p>
      </div>,
      /* Two thirds of the height, centred, so the reel shows above and
         below the films as well as between them. Julian asked for the
         tiles smaller so the background is seen. */
      <div
        key={section.id}
        className="w-full shrink-0 sm:flex sm:h-full sm:w-auto sm:items-center"
      >
        <div className="sm:h-[62%]">
          <VideoGrid videos={section.films} onOpen={setOpen} rows />
        </div>
      </div>,
    );
  }

  cells.push(ask);

  /* The strip's scroller, read for how far along it is: the veil over the
     reel thickens with it (see `ReelBackdrop`). */
  const scroller = React.useRef<HTMLDivElement | null>(null);

  return (
    <>
      <ReelBackdrop scroller={scroller} />
      <Strip
        ref={scroller}
        label={`Motion: ${filmCount(all)} films, left and right`}
        next={next}
        className="mt-4 flex-1"
      >
        {cells}
      </Strip>

      <VideoViewer videos={all} current={open} onChange={setOpen} />
    </>
  );
}

/* ── the reel, behind the page ────────────────────────────────────
 * Vimeo's background mode: muted, looping, no chrome, and it starts on its
 * own because it is silent. The frame is cut to cover the window whatever
 * the window's shape, and over it sits a veil in the page's own ground
 * colour, so the type keeps its contrast in either theme: paper over the
 * reel in the light, black over it in the dark.
 *
 * The veil is thin at the start, where the reel is most of what there is
 * to see, and thickens as the strip moves into the film sections, where
 * the reel has become a backdrop to a row of other films. Julian chose
 * dimmed and darkening as you scroll. `--reel-dim` is written by hand
 * from the scroller's position rather than through state: it changes
 * every frame of a drag.
 *
 * Fixed inside `<main>`, which carries a transform, so "fixed" means the
 * box of main; on a strip page main is the window, which is what is
 * wanted. Behind main's content through a negative z-index: main's own
 * ground is transparent and the body's shows through the veil.
 * ─────────────────────────────────────────────────────────────── */
function ReelBackdrop({
  scroller,
}: {
  scroller: React.RefObject<HTMLDivElement | null>;
}) {
  const veil = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scroller.current;
    const v = veil.current;
    if (!el || !v) return;
    const read = () => {
      const room = el.scrollWidth - el.clientWidth;
      const at = room > 0 ? Math.min(1, Math.max(0, el.scrollLeft / room)) : 0;
      v.style.setProperty("--reel-dim", at.toFixed(3));
    };
    read();
    el.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    return () => {
      el.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, [scroller]);

  /* In the rack there is no scroll along the reel to dim it, so the film
     playing behind stayed bright under a grid of stills and its titles
     read through the page as a ghost. The rack is a catalogue; the reel
     belongs to the strip. */
  if (React.useContext(StripView) === "grid") return null;

  return (
    <div
      ref={veil}
      aria-hidden
      className="reel-backdrop pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <iframe
        // From two seconds in, past the slate. Julian asked.
        src={`https://player.vimeo.com/video/${REEL.videoId}?background=1&autoplay=1&loop=1&muted=1&dnt=1#t=2s`}
        title={REEL.title}
        allow="autoplay; encrypted-media"
        tabIndex={-1}
        className="reel-backdrop-frame absolute left-1/2 top-1/2"
      />
      <div className="reel-veil absolute inset-0" />
    </div>
  );
}
