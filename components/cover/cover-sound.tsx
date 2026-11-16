"use client";

import * as React from "react";
import SOUND from "@/lib/cover-art-sound.json";

/* The song on the cover (inner pages plan, `snd`, only with `?v4pages=c1,snd`): one clip at a time through one
   audio element, made on the first play, so with the key off nothing here runs and nothing is fetched.
   The clip is Apple's preview where `scripts/cover-art-sound.mjs` matched one, Julian's own file otherwise;
   a release with neither, a clip that fails to load and a play the browser blocks are all just silence. */
type Clip = { id?: number; preview?: string; link?: string; clip?: string };
const clips: Record<string, Clip> = SOUND;
/* In over 1.4s on a curve that starts slow (Julian, 2026-11-15: fade in smoothly), out in 0.5s. */
const KEY = "jg-cover-snd", PEAK = 0.5, IN = 1400, OUT = 500;

let audio: HTMLAudioElement | null = null, now = "", raf = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const sub = (f: () => void) => (subs.add(f), () => void subs.delete(f));
const muted = () => {
  try {
    return sessionStorage.getItem(KEY) === "0";
  } catch {
    return false;
  }
};

function fade(a: HTMLAudioElement, to: number, ms: number, done?: () => void) {
  cancelAnimationFrame(raf);
  const from = a.volume, t0 = performance.now();
  const tick = (t: number) => {
    const k = Math.min(1, Math.max(0, (t - t0) / ms));
    // Squared on the way up: loudness is heard on a curve, and a straight ramp arrives all at once.
    a.volume = from + (to - from) * (to > from ? k * k : k);
    if (k < 1) raf = requestAnimationFrame(tick);
    else done?.();
  };
  raf = requestAnimationFrame(tick);
}

/** Fades the clip out and stops it: this release's, or whichever is playing. `hard` skips the fade
    (a hidden tab runs no frames, so a fade there would never end). */
export function stopSound(slug?: string, hard = false) {
  const a = audio;
  if (!a || !now || (slug && slug !== now)) return;
  now = "";
  emit();
  if (hard) {
    cancelAnimationFrame(raf);
    a.pause();
  } else fade(a, 0, OUT, () => a.pause());
}

export function playSound(slug: string) {
  const src = clips[slug]?.preview ?? clips[slug]?.clip;
  if (!src || slug === now || muted()) return;
  if (!audio) {
    audio = new Audio();
    audio.onended = audio.onerror = () => {
      now = "";
      emit();
    };
    document.addEventListener("visibilitychange", () => document.hidden && stopSound(undefined, true));
  }
  const a = audio;
  cancelAnimationFrame(raf);
  a.src = src;
  a.volume = 0;
  now = slug;
  emit();
  // Blocked before a first click or key, or the file is gone: silence, nothing thrown or logged.
  a.play().then(
    () => now === slug && fade(a, PEAK, IN),
    () => {
      if (now === slug) {
        now = "";
        emit();
      }
    },
  );
}

/** The slug whose clip is playing, "" when none. */
export const useSound = () => React.useSyncExternalStore(sub, () => now, () => "");

/* Sound on / off, kept for the tab. While one of Apple's previews plays: Apple's mark linking to the song and the
   credit, both of which its terms ask for beside a preview (Search API, Legal). */
export function CoverSound({ className }: { className?: string }) {
  const off = React.useSyncExternalStore(sub, muted, () => false);
  const clip = clips[useSound()];
  return (
    <div className={className ? `cv4s ${className}` : "cv4s"}>
      <button
        type="button"
        aria-pressed={!off}
        onClick={() => {
          try {
            sessionStorage.setItem(KEY, off ? "1" : "0");
          } catch {}
          if (!off) stopSound();
          emit();
        }}
      >
        {off ? "Sound off" : "Sound on"}
      </button>
      {clip?.preview && clip.link ? (
        <>
          {/* Apple's own one-colour "Listen on Apple Music" mark, unaltered (tools.applemediaservices.com, mono-black
              and mono-white): its terms ask for Apple's artwork, not a text link. Black on light, white on dark. */}
          <a href={clip.link} target="_blank" rel="noopener noreferrer" aria-label="Listen on Apple Music">
            {/* eslint-disable @next/next/no-img-element -- 8 KB SVGs, nothing for the image loader to do */}
            <img className="am-b" src="/apple-music-black.svg" alt="" width={124} height={27} />
            <img className="am-w" src="/apple-music-white.svg" alt="" width={124} height={27} />
            {/* eslint-enable @next/next/no-img-element */}
          </a>
          <span>Preview provided courtesy of iTunes</span>
        </>
      ) : null}
    </div>
  );
}
