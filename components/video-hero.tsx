"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ── the reel ─────────────────────────────────────────────────────
 * The director's reel, running across the top of /work/video.
 *
 * Everything below it is a still with a play button, because eight
 * autoplaying players would be a megabyte of somebody else's JavaScript and a
 * page that fights the visitor. This one is the exception and it earns it: a
 * reel is the argument for the whole page, and a reel behind a play button is
 * an argument nobody hears.
 *
 * ── about the volume ─────────────────────────────────────────────
 * It starts at 15%, where the browser allows it.
 *
 * That "where" is not hedging. Every browser refuses to start a video with
 * sound on a page the visitor has not interacted with — Chrome relents on
 * sites somebody uses often, Safari almost never does — and there is no way
 * to ask in advance. So the sequence is: play muted, which always works, then
 * immediately try to turn it down to 15% and unmute. If that is refused, or
 * if the player pauses in protest, it goes back to muted and keeps playing
 * with the press below offered instead.
 *
 * Which means one press is always enough, and on a permissive browser no
 * press is needed. What it never does is fail silently in the other
 * direction: sound at full volume nobody asked for is the oldest way to lose
 * a visitor.
 *
 * Vimeo has no URL parameter for volume — `muted` is all the embed takes — so
 * this needs their player API, and `player.vimeo.com` is in `script-src` for
 * that one reason. It is loaded on this page only, after the frame is up.
 * ─────────────────────────────────────────────────────────────── */

/** Julian's number. Present but under the room, not a soundtrack. */
const VOLUME = 0.15;

type VimeoPlayer = {
  setVolume: (v: number) => Promise<number>;
  setMuted: (m: boolean) => Promise<boolean>;
  play: () => Promise<void>;
  getPaused: () => Promise<boolean>;
  unload: () => Promise<void>;
};

type VimeoApi = {
  Player: new (el: HTMLIFrameElement) => VimeoPlayer;
};

/**
 * `player.js`, fetched once per page and shared by every caller.
 *
 * Held in a module-level promise rather than state: two hero frames on one
 * page would otherwise race to append the same script, and a second copy of
 * the API would attach a second set of message listeners to every frame.
 */
let api: Promise<VimeoApi> | null = null;

function vimeoApi(): Promise<VimeoApi> {
  api ??= new Promise<VimeoApi>((resolve, reject) => {
    const existing = (window as unknown as { Vimeo?: VimeoApi }).Vimeo;
    if (existing) return resolve(existing);

    const tag = document.createElement("script");
    tag.src = "https://player.vimeo.com/api/player.js";
    tag.async = true;
    tag.onload = () => {
      const loaded = (window as unknown as { Vimeo?: VimeoApi }).Vimeo;
      if (loaded) resolve(loaded);
      else reject(new Error("player.js loaded without Vimeo"));
    };
    tag.onerror = () => reject(new Error("player.js did not load"));
    document.head.append(tag);
  });
  return api;
}

export function VideoHero({
  videoId,
  title,
  year,
  children,
}: {
  videoId: string;
  title: string;
  /** When it was cut. Printed in the label the screen reader hears. */
  year?: number;
  /** The page's own heading, which sits on the lower third of the film. */
  children?: React.ReactNode;
}) {
  /* Tells the fixed header it is over a picture, so it plates itself the way
     it does on the cover — the same attribute `hero.tsx` sets, for the same
     reason. Without it the bar is transparent over a moving image and its
     type survives exactly as long as the shot it happens to be on. */
  React.useEffect(() => {
    document.documentElement.dataset.cover = "true";
    return () => {
      delete document.documentElement.dataset.cover;
    };
  }, []);

  const frame = React.useRef<HTMLDivElement>(null);
  const iframe = React.useRef<HTMLIFrameElement>(null);
  const player = React.useRef<VimeoPlayer | null>(null);

  /** Whether sound is actually on, which is not the same as wanting it on. */
  const [sounding, setSounding] = React.useState(false);

  /* Starts muted in the markup and stays that way in the URL.
   *
   * `muted=1` is what makes autoplay legal everywhere; the volume is set
   * through the API below, on the same player, without a reload. `controls=0`
   * because a control bar under a page-top reel reads as an embed rather than
   * as the page. */
  const src = `https://player.vimeo.com/video/${videoId}?autoplay=1&loop=1&muted=1&controls=0&playsinline=1&dnt=1&title=0&byline=0&portrait=0`;

  /** Turn it down, then turn it on. Reverts if the browser says no. */
  const withSound = React.useCallback(async (p: VimeoPlayer) => {
    // Volume first: unmuting before the level is set is how a page shouts for
    // the one frame it takes to obey.
    await p.setVolume(VOLUME);
    await p.setMuted(false);
    await p.play();

    /* Chrome's answer to an unrequested unmute is not an error — it pauses
       the video. So the state is read back rather than assumed. */
    if (await p.getPaused()) throw new Error("paused on unmute");
    return true;
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    void vimeoApi()
      .then(async (Vimeo) => {
        if (cancelled || !iframe.current) return;
        const p = new Vimeo.Player(iframe.current);
        player.current = p;

        try {
          await withSound(p);
          if (!cancelled) setSounding(true);
        } catch {
          // Refused. Back to wallpaper, and the press below is the way in.
          await p.setMuted(true).catch(() => {});
          await p.play().catch(() => {});
        }
      })
      .catch(() => {
        // No API — an ad blocker, or the script blocked. The frame is still
        // playing muted from its own URL, which is the important half.
      });

    return () => {
      cancelled = true;
    };
  }, [withSound]);

  /**
   * Sound on at 15%, or off. The one control a silent autoplaying video owes
   * the visitor: it started without being asked, so turning it off has to be
   * one press and has to be visible without hunting.
   */
  function toggleSound() {
    const p = player.current;
    if (!p) return;

    if (sounding) {
      setSounding(false);
      void p.setMuted(true).catch(() => {});
      return;
    }

    void withSound(p)
      .then(() => setSounding(true))
      .catch(() => {});
  }

  /** Fill the screen. A refusal is not a failure, so nothing waits on it. */
  function goFullscreen() {
    void frame.current?.requestFullscreen?.().catch(() => {});
  }

  return (
    <section
      aria-label={title}
      className="relative border-b border-border bg-card"
    >
      {/* The whole screen, and it starts at the top of the document: the bar
          floats over it, plated, as it does over the cover. */}
      <div
        ref={frame}
        className="relative h-dvh w-full overflow-hidden bg-black"
      >
        {/* A 16:9 film covering a screen that is almost never 16:9.

            An iframe cannot be told to `object-fit: cover`, so the frame is
            given the larger of the two dimensions it could need and centred
            on the overflow: 177.78dvh is 16/9 of the height, 56.25vw is 9/16
            of the width, and `max()` picks whichever one is doing the
            covering. The other axis spills and is clipped, which is what
            cover means.

            `pointer-events-none` so the press below always lands here rather
            than in Vimeo's own frame — and because a control bar we have
            switched off cannot be reached in any case. */}
        <iframe
          ref={iframe}
          src={src}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          aria-hidden
          tabIndex={-1}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[max(100dvh,56.25vw)] w-[max(100vw,177.78dvh)] -translate-x-1/2 -translate-y-1/2 border-0"
        />

        {/* The film itself means fullscreen, which is the one thing a press
            on a video without controls should do. Under the plate in the
            stack, never over it — a button covering the heading would swallow
            a press meant for something in it. */}
        <button
          type="button"
          onClick={goFullscreen}
          aria-label={`${year ? `${title}, ${year}` : title} — fullscreen`}
          className="absolute inset-0 z-0"
        />

        {/* The page's heading, on the lower third of the film.

            The same plate the cover uses — the ground at 45% under a heavy
            blur — rather than a gradient scrim. A gradient dims the
            photograph to make type survive it; a plate admits it is chrome
            and leaves the picture above it alone. This site made that trade
            once already on the cover and it is the same trade here.

            `pointer-events-none` on the plate with the controls inside it
            switched back on: the film underneath stays pressable through the
            dead space, so the whole banner is one target except where there
            is something else to press. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex min-h-[33%] flex-col justify-end border-t border-border/60 bg-background/45 px-6 py-8 backdrop-blur-2xl sm:px-10 sm:py-10">
          <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-end justify-between gap-x-10 gap-y-6">
            {children}

            {/* Two controls, because they are two decisions.

                Sound first and always visible: the film starts on its own, so
                the press that stops it being heard cannot be the same press
                that changes the size of everything. The label says what will
                happen, not what is happening — a button that reads "Sound"
                while it is already playing is a status light pretending to be
                a control. */}
            <div className="pointer-events-auto flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={sounding}
                className={cn(
                  "flex items-center gap-3 border border-border px-4 py-2.5",
                  "transition-colors duration-200 hoverable:hover:bg-card press",
                )}
              >
                {/* Drawn, like every other icon here. The wave is the state:
                    one arc when it is audible, a cross when it is not. */}
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="currentColor"
                >
                  <path d="M4 9h3l5-4v14l-5-4H4z" />
                  {sounding ? (
                    <path
                      d="M16.5 8.5a5 5 0 0 1 0 7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  ) : (
                    <path
                      d="M16 9.5l5 5m0-5l-5 5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                <span className="label">{sounding ? "Mute" : "Sound"}</span>
              </button>

              <button
                type="button"
                onClick={goFullscreen}
                aria-label="Play fullscreen"
                className={cn(
                  "flex items-center gap-3 border border-border px-4 py-2.5",
                  "transition-colors duration-200 hoverable:hover:bg-card press",
                )}
              >
                {/* Four corners, which is what fullscreen looks like
                    everywhere and therefore needs no label to be understood —
                    though it has one, because an icon alone in a row with a
                    labelled sibling reads as an afterthought. */}
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="size-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
                </svg>
                <span className="label">Fullscreen</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
