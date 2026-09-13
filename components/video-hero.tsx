"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the reel ─────────────────────────────────────────────────────
 * The director's reel, running silently across the top of /work/video.
 *
 * Everything below it is a still with a play button, because eight autoplaying
 * players would be a megabyte of someone else's JavaScript and a page that
 * fights the visitor. This one is the exception and it earns it: a reel is the
 * argument for the whole page, and a reel behind a play button is an argument
 * nobody hears.
 *
 * Silent, looping, no controls — Vimeo's `background=1`, which is the mode
 * made for exactly this. A muted video is the only kind a browser will start
 * on its own, and it is the only kind that should: sound nobody asked for is
 * the oldest way to lose a visitor.
 *
 * One press does both things worth doing — unmutes it and fills the screen.
 * Fullscreen is requested on the element itself rather than through Vimeo's
 * player API, which would mean loading `player.js` from a third party and
 * widening `script-src` for a single call. The browser grants it because the
 * request comes from inside a click, and where it refuses — an old iOS, an
 * embedded webview — the reel still swaps to a player with sound and
 * controls, which was the substance of the press anyway.
 * ─────────────────────────────────────────────────────────────── */

export function VideoHero({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  /** Silent wallpaper, or the real player with sound. */
  const [playing, setPlaying] = React.useState(false);
  const frame = React.useRef<HTMLDivElement>(null);

  const src = playing
    ? // `dnt=1`: Vimeo is asked not to track, like every other embed here.
      `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=0&dnt=1&title=0&byline=0&portrait=0`
    : `https://player.vimeo.com/video/${videoId}?background=1&autoplay=1&loop=1&muted=1&dnt=1`;

  function open() {
    setPlaying(true);
    // Best effort, and deliberately unawaited: a refusal is not a failure —
    // the player has already swapped to one with sound.
    void frame.current?.requestFullscreen?.().catch(() => {});
  }

  return (
    <section
      aria-label={title}
      className="relative border-b border-border bg-card"
    >
      {/* Full bleed, and 16:9 by the box rather than by the padding trick the
          embed code arrives with: `aspect-video` states the ratio where
          `padding-top: 56.25%` implies it, and it cannot be knocked out of
          step by a stylesheet that touches padding. */}
      <div ref={frame} className="relative aspect-video w-full overflow-hidden">
        <iframe
          // Remounts on the swap, so the silent copy is gone rather than
          // playing on underneath the one with sound.
          key={String(playing)}
          src={src}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />

        {!playing ? (
          /* The whole frame is the button.

             Over the iframe rather than inside it: a cross-origin frame
             swallows its own clicks, so a control that sits under it can
             never be pressed. That also means the reel cannot be paused or
             scrubbed while it is wallpaper, which is correct — it has no
             controls, and the one thing to do with it is this. */
          <button
            type="button"
            onClick={open}
            className="group absolute inset-0 flex items-end justify-between gap-6 p-6 text-left sm:p-10"
          >
            {/* A scrim only where the type is, and only at the foot: a full
                overlay on a moving image reads as a dimmed video rather than
                as a caption on one. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/55 to-transparent"
            />

            <span className="relative flex flex-col gap-1">
              <span className="label text-white/70">Director&rsquo;s reel</span>
              <span className="font-display text-2xl uppercase leading-none tracking-[0] text-white sm:text-3xl">
                {title}
              </span>
            </span>

            <span
              className={cn(
                "relative flex shrink-0 items-center gap-3 border border-white/40 bg-black/30 px-4 py-2.5 backdrop-blur-sm",
                "transition-colors duration-200 group-hover:border-white/80 group-hover:bg-black/50",
              )}
            >
              {/* Drawn, like every other icon here. A speaker with one wave:
                  the mark says "sound", which is the half of the press a
                  visitor cannot see coming — fullscreen they can. */}
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="size-4 text-white"
                fill="currentColor"
              >
                <path d="M4 9h3l5-4v14l-5-4H4z" />
                <path
                  d="M16.5 8.5a5 5 0 0 1 0 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
              <span className="label text-white">Play with sound</span>
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
