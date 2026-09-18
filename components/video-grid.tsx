"use client";

import * as React from "react";
import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { embedUrl, posterFor, previewUrl, type Video } from "@/lib/videos";
import { cn } from "@/lib/utils";

/* ── the tiles ────────────────────────────────────────────────────
 * A still with a play button. The iframe arrives on the click.
 *
 * Nothing from YouTube or Vimeo is fetched before then — a page that mounts
 * eight players has pulled a megabyte of somebody else's JavaScript, set
 * their cookies and lost its LCP before the visitor decided to watch
 * anything. One press is what they were going to do anyway, and it is the
 * press that authorises the third party.
 *
 * Fluid throughout: the grid fills on a minimum column width, so the number
 * of columns is whatever the width affords rather than a set of breakpoints,
 * and every tile is an `aspect-video` box, so the row heights are known
 * before the still loads and nothing shifts when it does.
 *
 * Along a strip (`rows`) the same tiles run two rows deep, each as tall as
 * half the strip, with the caption on a plate over the still.
 * ─────────────────────────────────────────────────────────────── */

export function VideoGrid({
  videos,
  onOpen,
  rows = false,
}: {
  videos: Video[];
  /** When given, a press opens the film here instead of playing it in
      its tile; see `video-viewer.tsx`. */
  onOpen?: (video: Video) => void;
  /** Two rows running along a strip, the tiles as tall as half of it,
      with the caption on a plate over the still. On a phone, one column. */
  rows?: boolean;
}) {
  /** Which tile has been asked to play. One at a time. */
  const [playing, setPlaying] = React.useState<string | null>(null);

  if (!videos.length) return null;

  return (
    <ul
      className={cn(
        "grid",
        rows
          ? "h-full grid-flow-col grid-rows-2 gap-3 max-sm:h-auto max-sm:grid-flow-row max-sm:grid-cols-1 max-sm:gap-6"
          : [
              "mt-8 gap-x-6 gap-y-10",
              // Siblings that cross the fold together, so they arrive as one
              // gesture rather than a flash of four simultaneous events. Every
              // child is revealed here, which is what this utility requires.
              "stagger",
              /* No breakpoints: a floor of 22rem gives one column on a phone, two
                 around 44rem and three around 66rem, with the tiles absorbing the
                 slack in between rather than jumping at a width somebody picked.

                 `auto-fill`, not `auto-fit`. They differ only when a row is not
                 full, and that is exactly the case here: `auto-fill` collapses the
                 empty tracks, so the Commercial section with one film in it drew a
                 single 1185px tile beside a Music video section of 580px ones —
                 the same page at two scales. `auto-fill` keeps the empty tracks,
                 so a lone film sits in a column the width of all the others. */
              "[grid-template-columns:repeat(auto-fill,minmax(min(22rem,100%),1fr))]",
            ],
      )}
    >
      {videos.map((video) => {
        const tile = (
          <Tile
            video={video}
            playing={playing === video.id}
            onPlay={() => (onOpen ? onOpen(video) : setPlaying(video.id))}
            /* The first still in a section is above the fold and it *is* the
               content — lazy-loading the thing the page is for costs a beat
               on arrival for nothing. The rest wait until they are scrolled
               to. */
            eager={videos.indexOf(video) === 0}
            box={rows ? "w-full sm:h-full sm:w-auto" : "w-full"}
          />
        );
        /* The caption reacts with the tile: everything in here is muted
           until the pointer is on the cell, which ties the words to the
           picture they belong to rather than leaving them as a separate
           thing below it. `group` is on the `<li>`'s child so the caption
           is inside the same hover as the frame. Along a strip it sits on
           a plate over the foot of the still instead, so the tile is the
           whole of its half of the height. */
        const caption = (
          <div
            className={cn(
              "flex flex-wrap items-baseline gap-x-4 gap-y-1",
              rows
                ? "pointer-events-none absolute inset-x-0 bottom-0 border-t border-border/60 glass-surface bg-background/70 px-4 py-3"
                : "mt-3",
            )}
          >
            <h3 className="font-display text-lg uppercase tracking-[0] transition-colors duration-200">
              {video.title}
            </h3>
            {video.client ? (
              <p className="label text-muted-foreground transition-colors duration-200 group-hover/cell:text-foreground">
                {video.client}
              </p>
            ) : null}
            {video.year ? (
              <p className="label ml-auto shrink-0 tabular-nums text-muted-foreground transition-colors duration-200 group-hover/cell:text-foreground">
                {video.year}
              </p>
            ) : null}
          </div>
        );
        return rows ? (
          <li key={video.id} className="group/cell relative min-h-0">
            {tile}
            {caption}
          </li>
        ) : (
          <li key={video.id} className="group/cell flex min-w-0 flex-col">
            <Reveal className="flex min-w-0 flex-col">
              {tile}
              {caption}
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}

function Tile({
  video,
  playing,
  onPlay,
  eager,
  box,
}: {
  video: Video;
  playing: boolean;
  onPlay: () => void;
  eager?: boolean;
  /** How the 16:9 box is sized: by its width in a grid, by its height
      along a strip. */
  box: string;
}) {
  const poster = posterFor(video);

  /* The film plays under the pointer, muted, from its best passage
     (`previewAt`), until the tile is pressed and it opens properly. Only
     where there is a pointer to hover with, and only after it has rested
     on the tile for a moment, so a pass across the row does not start
     four players. The player sits over the still with pointer events
     off, so the tile keeps its hover and its click. Julian asked. */
  const [previewing, setPreviewing] = React.useState(false);
  const rest = React.useRef(0);
  const hoverable = () =>
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const enter = () => {
    if (!hoverable()) return;
    window.clearTimeout(rest.current);
    rest.current = window.setTimeout(() => setPreviewing(true), 350);
  };
  const leave = () => {
    window.clearTimeout(rest.current);
    setPreviewing(false);
  };
  React.useEffect(() => () => window.clearTimeout(rest.current), []);

  if (playing) {
    return (
      <div className={cn("relative aspect-video overflow-hidden bg-card", box)}>
        <iframe
          // `key` on the id, so switching tiles cannot hand the new video the
          // old one's element and leave two players running.
          key={video.id}
          src={embedUrl(video)}
          title={video.title}
          // The two the players actually need. No `allow-same-origin` and no
          // payment, clipboard or microphone: an embed is here to draw a
          // rectangle and play a sound.
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      onPointerEnter={enter}
      onPointerLeave={leave}
      onFocus={enter}
      onBlur={leave}
      aria-label={`Play ${video.title}`}
      data-ring="Play"
      // `group` drives two things: the picture's zoom and the play mark
      // arriving. The inset outline that used to draw itself on hover is
      // gone, at Julian's ask.
      className={cn(
        "group relative aspect-video overflow-hidden bg-card press active:scale-[0.995]",
        box,
      )}
    >
      {poster ? (
        <Image
          data-fade=""
          src={poster}
          alt=""
          fill
          // A tile is at most a third of a 100rem column, and never more than
          // the viewport on a phone.
          sizes="(min-width: 66rem) 33vw, (min-width: 44rem) 50vw, 100vw"
          loading={eager ? "eager" : "lazy"}
          /* A slow zoom, and only the picture moves. 500ms rather than the
             200 a control would take: this is a large surface and a fast
             scale on a photograph reads as a jolt, where a slow one reads as
             the frame leaning in. Transform and opacity only, so it stays on
             the compositor. */
          className="object-cover transition-transform duration-500 ease-[var(--ease-out-strong)] hoverable:group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          // These are 16:9 thumbnails from a CDN, not frames from the
          // archive, so the loader that rewrites archive paths must not touch
          // them — `unoptimized` hands the URL through as it is.
          unoptimized
        />
      ) : null}

      {previewing ? (
        <iframe
          src={previewUrl(video)}
          title=""
          aria-hidden
          tabIndex={-1}
          allow="autoplay; encrypted-media"
          className="pointer-events-none absolute inset-0 h-full w-full border-0 animate-in fade-in duration-500"
        />
      ) : null}

      {/* The play mark, on request.

          Hidden until the pointer is on the tile — the poster is the work and
          a disc parked in the middle of every one of them is furniture. But
          hidden *only where there is a pointer*: `hoverable` is a hover-and-
          fine-pointer query, so on a touch screen, where hover never happens
          and nothing would ever reveal it, the mark stays where it is. That
          inversion is the whole reason this is two classes rather than
          `opacity-0` and a hover.

          It also comes back for a keyboard: a tile you can reach with Tab has
          to show what pressing it does.

          The disc exists for the mark and not for the picture: a white
          triangle on a pale still is invisible, and a mark with its own dark
          disc under it is legible on anything. */}
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="flex size-16 items-center justify-center glass transition-[opacity,scale] duration-300 ease-[var(--ease-out-strong)] hoverable:scale-90 hoverable:opacity-0 hoverable:group-hover:scale-100 hoverable:group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
          {/* Drawn, not imported — the same rule the rest of the icons here
              follow. A triangle, optically centred: a shape with a flat left
              edge and a point on the right reads as off-centre when its
              bounding box is centred, so it sits a pixel right. */}
          <svg
            viewBox="0 0 24 24"
            className="ml-[2px] size-6 text-foreground"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
