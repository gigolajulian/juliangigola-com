"use client";

import * as React from "react";
import { inkGround, inkWord } from "@/components/site/nav-ink";
import SOUND from "@/lib/work/cover-art-sound.json";

/* The song on the cover (inner pages plan, `snd`, only with `?v4pages=c1,snd`): one clip at a time, and nothing
   here runs or is fetched until the first play, so with the key off the page is untouched.
   The clip is Apple's preview where `scripts/cover-art-sound.mjs` matched one, Julian's own file otherwise, and for
   a song that is only on SoundCloud, SoundCloud's own player. A release with none, a clip that fails to load and a
   play the browser blocks are all just silence. */
type Clip = { id?: number; preview?: string; link?: string; clip?: string; soundcloud?: string };
const clips: Record<string, Clip> = SOUND;
/* In over 1.4s on a curve that starts slow, out in 0.5s.
   Peak 0.3 (owner pick, do not tune). */
const KEY = "jg-cover-snd", PEAK = 0.3, IN = 1400, OUT = 500;

let audio: HTMLAudioElement | null = null, now = "", raf = 0, level = 0, watching = false;
/** What the clip plays through: the audio element, or SoundCloud's player. */
let out: "audio" | "sc" = "audio";
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
const ended = () => {
  now = "";
  emit();
};

/* SoundCloud gives a page no clip to play itself, only its player: one frame kept off the screen, driven by the
   player's own messages (play, pause, setVolume 0 to 100, seekTo; it answers `ready` and `finish`). */
const SC = "https://w.soundcloud.com";
let frame: HTMLIFrameElement | null = null, scReady = false, scUrl = "";
const post = (method: string, value?: unknown) => frame?.contentWindow?.postMessage(JSON.stringify({ method, value }), SC);
function scGo() {
  post("setVolume", 0);
  post("seekTo", 0);
  post("play");
  fade(PEAK, IN);
}
function scPlay(url: string) {
  if (!frame) {
    frame = document.createElement("iframe");
    frame.allow = "autoplay";
    frame.title = "SoundCloud player";
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    // A real size, off the screen: at 1px SoundCloud's player draws its waveform on an empty canvas, which throws
    // in WebKit ("The object is in an invalid state", createPattern) and the track never starts (JG - MAC, #1086).
    frame.style.cssText = "position:fixed;left:-9999px;bottom:0;width:320px;height:166px;border:0;opacity:0;pointer-events:none";
    addEventListener("message", (e) => {
      if (e.origin !== SC || e.source !== frame?.contentWindow) return;
      let method = "";
      try {
        method = JSON.parse(e.data).method;
      } catch {}
      if (method === "ready") {
        scReady = true;
        post("addEventListener", "finish");
        if (out === "sc" && now) scGo();
      } else if (method === "finish" && out === "sc") ended();
    });
    document.body.append(frame);
  }
  if (scUrl === url) return void (scReady && scGo());
  scReady = false;
  scUrl = url;
  frame.src = `${SC}/player/?url=${encodeURIComponent(url)}&auto_play=false&show_artwork=false`;
}

const volume = (v: number) => {
  level = v;
  if (out === "sc") post("setVolume", v * 100);
  else if (audio) audio.volume = v;
};
const pause = () => (out === "sc" ? post("pause") : audio?.pause());

function fade(to: number, ms: number, done?: () => void) {
  cancelAnimationFrame(raf);
  const from = level, t0 = performance.now();
  const tick = (t: number) => {
    const k = Math.min(1, Math.max(0, (t - t0) / ms));
    // Squared on the way up: loudness is heard on a curve, and a straight ramp arrives all at once.
    volume(from + (to - from) * (to > from ? k * k : k));
    if (k < 1) raf = requestAnimationFrame(tick);
    else done?.();
  };
  raf = requestAnimationFrame(tick);
}

/** Fades the clip out and stops it: this release's, or whichever is playing. `hard` skips the fade
    (a hidden tab runs no frames, so a fade there would never end). */
export function stopSound(slug?: string, hard = false) {
  if (!now || (slug && slug !== now)) return;
  ended();
  if (hard) {
    cancelAnimationFrame(raf);
    pause();
  } else fade(0, OUT, pause);
}

export function playSound(slug: string) {
  const c = clips[slug], src = c?.preview ?? c?.clip, sc = src ? undefined : c?.soundcloud;
  if ((!src && !sc) || slug === now || muted()) return;
  if (!watching) {
    watching = true;
    document.addEventListener("visibilitychange", () => document.hidden && stopSound(undefined, true));
  }
  cancelAnimationFrame(raf);
  pause(); // whichever of the two was last on
  now = slug;
  emit();
  if (sc) {
    out = "sc";
    level = 0;
    return scPlay(sc);
  }
  out = "audio";
  if (!audio) {
    audio = new Audio();
    audio.onended = audio.onerror = ended;
  }
  audio.src = src!;
  volume(0);
  // Blocked before a first click or key, or the file is gone: silence, nothing thrown or logged.
  audio.play().then(
    () => now === slug && fade(PEAK, IN),
    () => now === slug && ended(),
  );
}

/** The slug whose clip is playing, "" when none. */
export const useSound = () => React.useSyncExternalStore(sub, () => now, () => "");

/* Sound on / off, kept for the tab. While one of Apple's previews plays: Apple's mark linking to the song and the
   credit, both of which its terms ask for beside a preview (Search API, Legal). While SoundCloud's player plays:
   SoundCloud's logo linking to the track. */
/** The sound line. In the viewer `slug` is the release on screen: a Preview button starts its clip (Julian
    2026-11-21: opening a cover plays nothing, the visitor asks for it), faded in as the hover's is. */
export function CoverSound({ className, slug, onPlay }: { className?: string; slug?: string; onPlay?: () => void }) {
  const off = React.useSyncExternalStore(sub, muted, () => false);
  const playing = useSound();
  const clip = clips[playing];
  const own = slug ? clips[slug] : undefined;
  const can = !!(own?.preview || own?.clip || own?.soundcloud);
  /* No ground under the line: each part is white or black from what shows under it, by the
     header's own measure (`inkWord`, components/site/nav-ink.ts). Looked at again on scroll and resize, and twice a
     second, as the header does, since a cover lifts under it with no scroll. */
  const line = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = line.current;
    if (!el) return;
    let raf = 0;
    const paint = () => {
      raf = 0;
      const page = inkGround(getComputedStyle(document.body).backgroundColor);
      for (const word of el.children) inkWord(word as HTMLElement, el, page);
    };
    const ask = () => void (raf ||= requestAnimationFrame(paint));
    const ac = new AbortController();
    addEventListener("scroll", ask, { passive: true, signal: ac.signal });
    addEventListener("resize", ask, { signal: ac.signal });
    const again = window.setInterval(() => document.hidden || ask(), 500);
    paint();
    return () => {
      ac.abort();
      clearInterval(again);
      cancelAnimationFrame(raf);
    };
  }, [clip]);
  return (
    <div ref={line} className={className ? `cv4s ${className}` : "cv4s"}>
      {slug && can && !off ? (
        <button
          type="button"
          aria-pressed={playing === slug}
          onClick={() => {
            if (playing === slug) return stopSound();
            onPlay?.();
            playSound(slug);
          }}
        >
          {playing === slug ? "Stop preview" : "Preview"}
        </button>
      ) : null}
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
      ) : clip?.soundcloud && !clip.clip ? (
        // SoundCloud's own logo files, unaltered (developers.soundcloud.com, logo_big_black and logo_big_white).
        <a className="sc" href={clip.soundcloud} target="_blank" rel="noopener noreferrer" aria-label="Listen on SoundCloud">
          {/* eslint-disable @next/next/no-img-element -- 4 KB PNGs at twice their shown size */}
          <img className="am-b" src="/soundcloud-black.png" alt="" width={100} height={12} />
          <img className="am-w" src="/soundcloud-white.png" alt="" width={100} height={12} />
          {/* eslint-enable @next/next/no-img-element */}
        </a>
      ) : null}
    </div>
  );
}
