"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Lightbox, useLightbox } from "@/components/cover/lightbox";
import { COVER_PRESS } from "@/lib/home/data";
import { sleeveTilt } from "./sleeve-tilt";
import "@/components/home/motion/rows.css";
import { CoverSound, playSound, stopSound, useSound } from "@/components/cover/cover-sound";
import type { CoverRelease } from "@/lib/work/cover-art-types";
import { useV4pages } from "@/lib/flags/v4pages";

/* ── the cover-art sheet ──────────────────────────────────────────
 * Every release, three across at every size. Each cell is the V4 home's
 * sleeve (`.mt-sleeve`, mtscroll.css): on a fine pointer the cover lifts and
 * its record slides out. A click opens side A; the back is in the viewer,
 * which pages through every side in order.
 * ─────────────────────────────────────────────────────────────── */

/** How a release reads to a screen reader, sides included. */
export function coverLabel(title: string, artist: string, frames: CoverRelease["frames"]): string {
  const sides = frames
    .map((f) => f.side?.toLowerCase())
    .filter(Boolean)
    .join(" and ");
  return `${title} by ${artist}${sides ? `, ${sides}` : ""}`;
}

export function CoverArtGallery({ releases }: { releases: CoverRelease[] }) {
  const list = React.useRef<HTMLUListElement>(null);
  /* The song on the cover (`snd`, components/cover/cover-sound.tsx): the pointer held on one for 4.3 seconds plays
     it, so crossing or browsing the grid fires nothing, and the viewer's Preview button does (Julian 2026-11-21). */
  const snd = useV4pages("snd");
  const playing = useSound();
  /** The release whose clip a click started: the viewer's, so the pointer leaving its sleeve does not stop it. */
  const held = React.useRef("");
  /** When the viewer last closed: the pointer is still on the sleeve it opened from, and that is not a held hover. */
  const shut = React.useRef(0);
  React.useEffect(() => {
    const ac = new AbortController();
    const fine = matchMedia("(hover:hover) and (pointer:fine)"), calm = matchMedia("(prefers-reduced-motion: reduce)");
    const ok = () => fine.matches && !calm.matches;
    list.current?.querySelectorAll<HTMLElement>(".mt-sleeve").forEach((it) => {
      sleeveTilt(it, ok, { signal: ac.signal });
      const slug = it.dataset.snd;
      if (!slug) return;
      let wait = 0;
      it.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "touch" || !ok() || performance.now() - shut.current < 1200) return;
        wait = window.setTimeout(() => {
          // Browsers block sound before a first click or key: do not even ask for the file until then.
          if (ac.signal.aborted || navigator.userActivation?.hasBeenActive === false) return;
          playSound(slug);
        }, 4300);
      }, { signal: ac.signal });
      it.addEventListener("pointerleave", () => {
        clearTimeout(wait);
        if (held.current !== slug) stopSound(slug);
      }, { signal: ac.signal });
    });
    return () => {
      ac.abort();
      if (snd) stopSound();
    };
  }, [snd]);

  // The lightbox pages through every side in order, so arrowing off side A
  // lands on side B rather than skipping to the next release.
  const frames = React.useMemo(
    () => releases.flatMap((r) => r.frames),
    [releases],
  );
  const lightbox = useLightbox(frames);

  // Closing the viewer, or arrowing to another release in it, ends the clip. The back of the same sleeve does not.
  const quiet = () => {
    if (!held.current) return;
    held.current = "";
    shut.current = performance.now();
    stopSound();
  };
  const shown = frames[lightbox.index]?.src;
  const viewing = lightbox.open ? releases.find((r) => r.frames.some((f) => f.src === shown))?.slug ?? "" : "";
  React.useEffect(() => {
    if (snd && viewing && viewing !== held.current) quiet();
  }, [snd, viewing]);

  // A cell opens at its own position in that flat sequence. Keyed by `src`,
  // which is unique per side.
  const positions = React.useMemo(
    () => new Map(frames.map((f, i) => [f.src, i])),
    [frames],
  );

  // `?cover=<slug>`: a cover clicked on the home (components/home/rows.tsx) arrives open in the viewer, on side A, with no history entry of its own: one Back goes home.
  React.useEffect(() => {
    const slug = new URLSearchParams(location.search).get("cover");
    const release = slug ? releases.find((r) => r.slug === slug) : undefined;
    if (release) lightbox.show(positions.get(release.frames[0].src) ?? 0, null, false);
    // once, on arrival: a later change of releases is not a new arrival
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ul ref={list} data-ring="Zoom" className="cv4">
        {releases.map((release, i) => {
          const front = release.frames[0];
          if (!front) return null;

          return (
            <li key={release.slug}>
              <button
                type="button"
                onClick={(e) => {
                  // Opening plays nothing (Preview in the viewer does); a clip the hover already started keeps playing
                  // into the viewer, and ends when it closes.
                  if (snd && playing === release.slug) held.current = release.slug;
                  lightbox.show(positions.get(front.src) ?? 0, e.currentTarget.querySelector<HTMLElement>("img"));
                }}
                aria-label={`Open ${coverLabel(release.title, release.artist, release.frames)}`}
                data-vt={front.src}
                data-ring="Zoom"
                data-snd={snd ? release.slug : undefined}
                // The record turns while its clip plays (v4pages.css). An attribute, not a class: a changing
                // className made React rewrite the class and drop the hover's `hv`, so the sleeve fell back in.
                data-playing={snd && playing === release.slug ? "" : undefined}
                className="group mt-sleeve"
                // The pressing: the home's color where it names one, the cover's own otherwise.
                style={{ "--press": COVER_PRESS[release.slug] ?? front.color } as React.CSSProperties}
              >
                <span className="disc" aria-hidden />
                <span className="face">
                  <Image data-frame={front.src} src={front.src} alt={front.alt} fill sizes="34vw" priority={i < 3} style={{ background: front.color }} />
                </span>
                {/* Named the way the home names its covers: a mono caption under the sleeve, no band over the art. */}
                <span className="cv4c" aria-hidden><span>{release.title}</span><span className="mute">{release.artist}</span></span>
              </button>
            </li>
          );
        })}
      </ul>

      <Lightbox
        frames={frames}
        name="Cover Art"
        {...lightbox}
        onOpenChange={(o) => {
          if (!o) quiet();
          lightbox.onOpenChange(o);
        }}
        // counted by release, as the page's own count is: a sleeve's back is the same record
        place={[Math.max(0, releases.findIndex((r) => r.frames.some((f) => f.src === shown))) + 1, releases.length]}
        note={snd ? <CoverSound slug={viewing} onPlay={() => (held.current = viewing)} /> : undefined}
      />
      {/* On the body: `main` carries a transform, and a fixed line inside it would sit at the foot of the page. */}
      {snd && !lightbox.open ? createPortal(<CoverSound className="cv4sf" />, document.body) : null}
    </>
  );
}
