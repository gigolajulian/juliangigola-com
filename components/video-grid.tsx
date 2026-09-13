"use client";

import * as React from "react";
import Image from "next/image";
import { Reveal } from "@/components/reveal";
import { embedUrl, posterFor, type Video } from "@/lib/videos";
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
 * ─────────────────────────────────────────────────────────────── */

export function VideoGrid({ videos }: { videos: Video[] }) {
  /** Which tile has been asked to play. One at a time. */
  const [playing, setPlaying] = React.useState<string | null>(null);

  if (!videos.length) return null;

  return (
    <ul
      className={cn(
        "mt-8 grid gap-x-6 gap-y-10",
        // Siblings that cross the fold together, so they arrive as one
        // gesture rather than a flash of four simultaneous events. Every
        // child is revealed here, which is what this utility requires.
        "stagger",
        /* No breakpoints: a floor of 22rem gives one column on a phone, two
           around 44rem and three around 66rem, with the tiles absorbing the
           slack in between rather than jumping at a width somebody picked.
           
           `auto-fill`, not `auto-fit`. They differ only when a row is not
           full, and that is exactly the case here: `auto-fit` collapses the
           empty tracks, so the Commercial section with one film in it drew a
           single 1185px tile beside a Music video section of 580px ones —
           the same page at two scales. `auto-fill` keeps the empty tracks,
           so a lone film sits in a column the width of all the others. */
        "[grid-template-columns:repeat(auto-fill,minmax(min(22rem,100%),1fr))]",
      )}
    >
      {videos.map((video) => (
        <li key={video.id} className="group/cell flex min-w-0 flex-col">
          <Reveal className="flex min-w-0 flex-col">
            <Tile
              video={video}
              playing={playing === video.id}
              onPlay={() => setPlaying(video.id)}
              /* The first still in a section is above the fold and it *is* the
               content — lazy-loading the thing the page is for costs a beat
               on arrival for nothing. The rest wait until they are scrolled
               to. */
              eager={videos.indexOf(video) === 0}
            />

            {/* The caption reacts with the tile: everything in here is muted
                until the pointer is on the cell, which ties the words to the
                picture they belong to rather than leaving them as a separate
                thing below it. `group` is on the `<li>`'s child so the
                caption is inside the same hover as the frame. */}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
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
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

function Tile({
  video,
  playing,
  onPlay,
  eager,
}: {
  video: Video;
  playing: boolean;
  onPlay: () => void;
  eager?: boolean;
}) {
  const poster = posterFor(video);

  if (playing) {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-card">
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
      aria-label={`Play ${video.title}`}
      className="group relative aspect-video w-full overflow-hidden bg-card press active:scale-[0.995]"
    >
      {poster ? (
        <Image
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
          className="object-cover transition-transform duration-500 ease-[var(--ease-out-strong)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          // These are 16:9 thumbnails from a CDN, not frames from the
          // archive, so the loader that rewrites archive paths must not touch
          // them — `unoptimized` hands the URL through as it is.
          unoptimized
        />
      ) : null}

      {/* The scrim exists for the play mark, not for the picture: a white
          triangle on a pale still is invisible, and a mark with its own dark
          disc under it is legible on anything. */}
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm transition-all duration-300 ease-[var(--ease-out-strong)] group-hover:scale-110 group-hover:bg-background/90 motion-reduce:transition-none">
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
