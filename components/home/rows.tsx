"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { COVER_RELEASES } from "@/lib/work/cover-art-data";
import type { CoverRelease } from "@/lib/work/cover-art-types";
import { media } from "@/lib/device";
import { projectHref } from "@/lib/work/project-href";
import { COVER_KEYS, COVER_PRESS, FILM_DRESS, type HomeFilm } from "@/lib/home/data";
import { pad } from "@/lib/utils";

/** A home cover opens on the Cover art page, in that page's viewer (`?cover=`, components/cover/cover-art-gallery.tsx). */
export const coverHref = (slug: string) => `${projectHref("coverart")}?cover=${encodeURIComponent(slug)}`;

const COVERS = COVER_KEYS.map((k) => COVER_RELEASES.find((r) => r.slug === k)).filter((r): r is CoverRelease => !!r);
/** The home shows the first four of the picks, in his order; the rest are one click away. */
const SHOWN = 4;

/* Four sleeves with a picture disc behind each. On scroll each sleeve slides in from the right, small with its record out,
   then grows to full size as the record goes back in (motion/flow.css, from the engine's --in). No driver. */
export function HomeCovers() {
  return (
    <section className="mt-covers" data-mt="covers" aria-labelledby="mt-cv-h">
      <div className="mt-frame mt-cv">
        <div className="mt-cv-head">
          <h2 id="mt-cv-h">Cover art</h2>
          <p className="lbl mute">Design</p>
        </div>
        <div className="mt-cv-grid">
          {COVERS.slice(0, SHOWN).map((c) => (
            <Link key={c.slug} href={coverHref(c.slug)} className="mt-cv-sleeve" style={{ "--press": COVER_PRESS[c.slug] } as React.CSSProperties}>
              <span className="mt-cv-disc" aria-hidden />
              <span className="mt-cv-face">
                <Image src={c.frames[0].src} alt={`${c.title} by ${c.artist}`} fill sizes="(min-width:1024px) 18vw, 37vw" />
              </span>
            </Link>
          ))}
        </div>
        <Link className="btn mt-cv-all" href="/portfolio?d=coverart">
          See all covers
        </Link>
      </div>
    </section>
  );
}

/* Motion (Julian 2026-11-26, mock A): one plain screen. The reel plays by default and is not on the list; hovering or
   focusing a title previews that film, leaving the list goes back to the reel. A click opens the film on /portfolio/video.
   On touch the first tap on a title previews it, a tap on the current one opens it. motion/rows.ts plays the previews. */
export function HomeFilms({ films }: { films: HomeFilm[] }) {
  const [cur, setCur] = React.useState(0);
  // WCAG 2.2.2: the reel starts by itself and loops, so it gets a way to stop. motion/rows.ts reads `data-paused`.
  const [paused, setPaused] = React.useState(false);
  // `data-was`: the film that was on screen stays under the new one until the new one is drawn, so the cut never shows black.
  const was = React.useRef(0);
  const list = React.useRef<HTMLOListElement>(null);
  React.useEffect(() => {
    const sec = list.current!.closest("section")!;
    sec.querySelectorAll<HTMLElement>(".mt-film").forEach((f, i) => {
      f.toggleAttribute("data-on", i === cur);
      f.toggleAttribute("data-was", i === was.current && i !== cur);
    });
    was.current = cur;
  }, [cur]);
  const hover = () => media("fine").matches;
  // a finger on a touch-only screen: its first tap previews. A screen reader's activation has no pointer and opens at once.
  const touch = React.useRef(false);
  const back = (e: React.FocusEvent | React.MouseEvent) => {
    const to = (e as React.FocusEvent).relatedTarget as Node | null;
    const kept = e.type === "mouseleave" ? list.current!.querySelector(":focus-visible") : to && list.current!.contains(to);
    if (!kept) setCur(0);
  };
  const dress = FILM_DRESS[films[cur].title];
  return (
    <section className="mt-motion" data-mt="motion" data-cur={cur} data-paused={paused ? "" : undefined} aria-labelledby="mt-mo-h">
      <div className="mt-stage">
        <div className="mt-mohead">
          <h2 id="mt-mo-h">Motion</h2>
          <p className="lbl mute">Director of Photography</p>
        </div>
        <div className="mt-mofilms" aria-hidden>
          {films.map((f, i) => (
            <div
              key={f.id}
              className="mt-film"
              data-film={f.id}
              data-preview={f.preview}
              data-file={f.file}
              data-on={i === 0 ? "" : undefined}
              style={FILM_DRESS[f.title]?.zoom ? ({ "--z": FILM_DRESS[f.title]?.zoom } as React.CSSProperties) : undefined}
            >
              {f.poster ? <Image src={f.poster} alt="" fill sizes="100vw" priority={false} /> : null}
            </div>
          ))}
        </div>
        {dress?.mark ? (
          <span
            key={dress.mark.src}
            className="mt-molg"
            role="img"
            aria-label={dress.mark.name}
            style={{ "--m": `url(${dress.mark.src})`, "--ar": dress.mark.w / dress.mark.h } as React.CSSProperties}
          />
        ) : null}
        <ol className="mt-molist" ref={list} onMouseLeave={back} onBlur={back} aria-label="Films">
          {films.slice(1).map((f, j) => {
            const i = j + 1;
            return (
              <li key={f.id} data-on={i === cur ? "" : undefined}>
                <Link
                  href={f.href}
                  onMouseEnter={() => hover() && setCur(i)}
                  // keyboard focus previews; a tap's own focus must not, or the tap that follows opens the film
                  onFocus={(e) => e.currentTarget.matches(":focus-visible") && setCur(i)}
                  onPointerDown={(e) => (touch.current = e.pointerType === "touch" && matchMedia("(hover: none)").matches)}
                  onClick={(e) => {
                    // touch: the first tap previews, the next one opens
                    if (touch.current && i !== cur) {
                      e.preventDefault();
                      setCur(i);
                    }
                  }}
                >
                  <span className="n lbl">{pad(j + 1)}</span>
                  <span className="t">{f.title}</span>
                  <span className="k lbl">
                    {f.kind} <i aria-hidden>|</i> {f.client}
                    <span className="w">Watch</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
        <div className="mt-moacts">
          <button type="button" className="lbl mt-mopause" onClick={() => setPaused((p) => !p)}>
            {paused ? "Play" : "Pause"}
          </button>
          <Link className="btn mt-sm mt-momore" href="/portfolio/video">
            View more
          </Link>
        </div>
      </div>
    </section>
  );
}
