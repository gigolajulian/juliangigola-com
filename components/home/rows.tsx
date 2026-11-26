"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { COVER_RELEASES } from "@/lib/work/cover-art-data";
import type { CoverRelease } from "@/lib/work/cover-art-types";
import { media } from "@/lib/device";
import { projectHref } from "@/lib/work/project-href";
import { holdEase, holdUnease } from "@/lib/motion/hold-ease";
import { clamp, progress } from "./motion/engine";
import { COVER_KEYS, COVER_PRESS, FILM_DRESS, type HomeFilm } from "@/lib/home/data";
import { pad } from "@/lib/utils";

/** A home cover opens on the Cover art page, in that page's viewer (`?cover=`, components/cover/cover-art-gallery.tsx). */
export const coverHref = (slug: string) => `${projectHref("coverart")}?cover=${encodeURIComponent(slug)}`;

const COVERS = COVER_KEYS.map((k) => COVER_RELEASES.find((r) => r.slug === k)).filter((r): r is CoverRelease => !!r);
/** The home shows the first four of the picks, in his order; the rest are one click away. */
const SHOWN = 4;

/* Spec 3.7: four sleeves with a picture disc behind each. On scroll each sleeve comes in from the right, then its record
   slides out and turns (motion/flow.css, from the engine's --in and --p). No driver. */
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

/* Spec 3.8. Phones and tablets: the same native snap row as HomeCovers. Desktop
   structure: the films stack one under another in natural scroll (motion/rows.ts
   opens the one at the middle of the screen). The current film is read here, so
   the head stays in step with the engine off too. */
export function HomeFilms({ films }: { films: HomeFilm[] }) {
  const row = React.useRef<HTMLDivElement>(null);
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    const el = row.current!;
    const sec = el.closest<HTMLElement>("section")!;
    const items = el.querySelectorAll<HTMLElement>(".mt-item");
    const mq = media("held");
    // On screen: the first film develops up from the dark page each time the section comes into view (rows.css).
    // From the first pixel, so the film is already coming up while the section slides over Cover art; at 0.2 it rose as a black slab first.
    const inView = new IntersectionObserver(([e]) => sec.toggleAttribute("data-in", e.isIntersecting), { threshold: 0 });
    inView.observe(sec);
    let raf = 0;
    let seen = true;
    // `on()`: a jump straight here (anchor, restore) scrolls once, before this fires, so read again when it does.
    const io = new IntersectionObserver(([e]) => ((seen = e.isIntersecting), on()), { rootMargin: "100% 0px" });
    const read = () => {
      raf = 0;
      if (items.length < 2 || !seen) return;
      // Desktop with motion: the films share one screen and the hold picks one (an even share of the scroll each).
      // Desktop without motion: the film nearest the middle of the screen. Elsewhere: the row's own snap step.
      if (mq.matches && document.documentElement.hasAttribute("data-mt-held")) {
        const r = sec.getBoundingClientRect();
        const p = Math.min(0.9999, progress(r.top, r.height, innerHeight, true));
        // the hold eases in and out like Cover art's, so the first and last film take more of the scroll
        return setCur(Math.floor(holdEase(p) * items.length));
      }
      const a = items[0].getBoundingClientRect(),
        b = items[1].getBoundingClientRect();
      const at = mq.matches ? (innerHeight / 2 - a.top - a.height / 2) / (b.top - a.top) : el.scrollLeft / (b.left - a.left);
      setCur(clamp(Math.round(at), 0, items.length - 1));
    };
    const on = () => (raf ||= requestAnimationFrame(read));
    el.addEventListener("scroll", on, { passive: true });
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    io.observe(el);
    on();
    return () => {
      io.disconnect();
      inView.disconnect();
      el.removeEventListener("scroll", on);
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  // `data-was`: the film that was on screen stays under the new one while it develops, so the swap never passes through black.
  const was = React.useRef(0);
  React.useEffect(() => {
    const items = row.current!.querySelectorAll<HTMLElement>(".mt-item");
    items.forEach((it, i) => (it.toggleAttribute("data-on", i === cur), it.toggleAttribute("data-was", i === was.current && i !== cur)));
    // keyboard: the film that held focus is hidden once the next one is current, and focus fell to the page. It follows the film.
    const a = document.activeElement;
    if (a instanceof HTMLElement && a.classList.contains("mt-film") && a !== items[cur] && row.current!.contains(a))
      items[cur]?.focus({ preventScroll: true });
    was.current = cur;
  }, [cur]);
  const dress = FILM_DRESS[films[cur].title];
  return (
    <section
      className="mt-held mt-motion"
      data-mt="motion"
      data-hold={films.length * 0.25 /* a quarter screen a film */}
      data-cur={cur}
      style={{ "--n": films.length } as React.CSSProperties}
    >
      <div
        className="mt-stage"
        onFocus={(e) => {
          // a film taking keyboard focus before the block is held: bring the stage up, so the film and its focus mark are whole on screen
          const top = e.currentTarget.getBoundingClientRect().top;
          // straight to the first film's resting place in the hold, so the snap (motion/rows.ts) has nothing left to move
          const sec = e.currentTarget.parentElement!,
            rest = !media("fine").matches ? 0 : holdUnease(0.5 / films.length) * (sec.offsetHeight - innerHeight);
          if (top > 0 && document.documentElement.hasAttribute("data-mt-held") && (e.target as Element).matches(".mt-film:focus-visible"))
            scrollBy({ top: top + rest });
        }}
      >
        <div className="mt-mohead">
          <h2>Motion</h2>
          <p className="lbl mute">Director of Photography</p>
        </div>
        <div className="mt-row" ref={row} role="group" tabIndex={0} aria-label="Films">
          <div className="mt-track">
            {films.map((f, i) => (
              <Link
                key={f.id}
                href={f.href}
                className="mt-item mt-film"
                tabIndex={i === cur ? 0 : -1 /* only the film on screen is in the Tab order: the others lie under it */}
                data-i={i}
                data-film={f.id}
                data-preview={f.preview}
                data-file={f.file}
                aria-label={`${f.title}, ${f.kind}`}
                style={FILM_DRESS[f.title]?.zoom ? ({ "--z": FILM_DRESS[f.title]?.zoom } as React.CSSProperties) : undefined}
              >
                {f.poster ? <Image src={f.poster} alt="" fill sizes="(max-width: 599px) 92vw, 100vw" /> : null}
              </Link>
            ))}
          </div>
        </div>
        {/* One screen (desktop with motion): which film of the four, the client mark top right, how far through the hold. */}
        <ol className="mt-mopg lbl" aria-hidden>
          {films.map((f, i) => (
            <li key={f.id} data-on={i === cur ? "" : undefined}>
              {pad(i + 1)}
            </li>
          ))}
        </ol>
        {dress?.mark ? (
          <span
            key={dress.mark.src}
            className="mt-molg"
            role="img"
            aria-label={dress.mark.name}
            style={{ "--m": `url(${dress.mark.src})`, "--ar": dress.mark.w / dress.mark.h } as React.CSSProperties}
          />
        ) : null}
        <span className="mt-mobar" aria-hidden />
        <div className="mt-mofoot">
          <p className="lbl">
            {pad(cur + 1)}/{pad(films.length)}
          </p>
          <h3 className="mt-ttl">
            <span className="ln">
              <span>{films[cur].title}</span>
            </span>
          </h3>
          <p className="lbl mute">
            {films[cur].kind} <i aria-hidden>|</i> {films[cur].client}
          </p>
          <Link className="btn mt-sm" href="/portfolio/video">
            Watch the films
          </Link>
        </div>
      </div>
    </section>
  );
}
