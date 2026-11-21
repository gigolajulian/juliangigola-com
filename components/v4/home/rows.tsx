"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { COVER_RELEASES } from "@/lib/cover-art-data";
import type { CoverRelease } from "@/lib/cover-art-types";
import { media } from "@/lib/device";
import { projectHref } from "@/lib/project-href";
import { holdEase, holdUnease } from "@/lib/motion/hold-ease";
import { clamp, MT2, progress } from "./motion/engine";
import { COVER_KEYS, COVER_PRESS, FILM_DRESS, pad, type MtFilm } from "@/lib/v4-home/data";

/** A home cover opens on the Cover art page, in that page's viewer (`?cover=`, components/cover/cover-art-gallery.tsx). */
export const coverHref = (slug: string) => `${projectHref("coverart")}?cover=${encodeURIComponent(slug)}`;

/* A tap on a two-sided sleeve turns it over on touch (?mttp=flip, motion/rows.ts), so that tap does not also leave the page. */
function keepFlip(e: React.MouseEvent<HTMLElement>) {
  if (e.currentTarget.hasAttribute("data-flip") && document.documentElement.hasAttribute("data-tp-flip") && !media("fine").matches) e.preventDefault();
  // Where the home was at the click, for `useBackToCover`: Safari put back a scroll saved before the last of the held row's
  // scroll, 618px short on a Mac and on Motion on the iPhone (MAC on #1313). Session storage: the router rewrites the history entry's state.
  else
    try {
      sessionStorage.setItem(BACK, String(scrollY));
    } catch {}
}

const BACK = "jg-cover-back";
/** When the last Back or Forward was: the home counts as a return only when it mounts just after one. */
let popAt = 0;
if (typeof window !== "undefined") addEventListener("popstate", () => (popAt = Date.now()));

/** Back from a cover on the Cover art page: the home's scroll as it was at the click (`keepFlip`), set once the page is laid out. */
function useBackToCover() {
  React.useEffect(() => {
    let y = NaN;
    try {
      y = Number(sessionStorage.getItem(BACK) ?? NaN);
    } catch {}
    if (Number.isNaN(y)) return;
    const go = () => scrollTo(0, y);
    let raf = 0, t2: ReturnType<typeof setTimeout> | undefined;
    // a tick on: the router renders the home inside the same popstate, before this file's listener has stamped it
    const t = setTimeout(() => {
      // taken here, not on mount: React's dev double mount read it once and dropped it
      try {
        sessionStorage.removeItem(BACK);
      } catch {}
      if (Date.now() - popAt > 2000) return;
      raf = requestAnimationFrame(go);
      // again once the held stages have taken their height, which can grow the page after the first frame
      t2 = setTimeout(() => Math.abs(scrollY - y) > 2 && go(), 400);
    });
    return () => (clearTimeout(t), clearTimeout(t2), cancelAnimationFrame(raf));
  }, []);
}

const COVERS = COVER_KEYS.map((k) => COVER_RELEASES.find((r) => r.slug === k)).filter((r): r is CoverRelease => !!r);

/* Spec 3.7: sleeves with a picture disc behind each. `--o` per sleeve (0 in,
   1 out) is the record's travel; the static page rests it at .5.
   A held block that names the current cover over one sideways row. Static form: a native scroll row with snap,
   which is also its touch and reduced-motion form. The current cover follows the row's own scroll (snap step),
   `data-cur` on the section. The motion pass (motion/rows.ts covers()) drives `--p` and transforms `.mt-track`. */
export function MtCovers() {
  const row = React.useRef<HTMLDivElement>(null);
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    const el = row.current!;
    let raf = 0;
    const held = media("held");
    const read = () => {
      raf = 0;
      if (MT2 && held.matches) return; // ?mt2=1: held, the driver tells the item; a stray row scroll (Tab into a cover) must not reset it
      const items = el.querySelectorAll<HTMLElement>(".mt-item");
      if (items.length < 2) return;
      const step = items[1].offsetLeft - items[0].offsetLeft;
      setCur(clamp(Math.round(el.scrollLeft / step), 0, items.length - 1));
    };
    const onScroll = () => (raf ||= requestAnimationFrame(read));
    el.addEventListener("scroll", onScroll, { passive: true });
    // ?mt2=1: on D the covers driver tells the item (motion/engine.ts tell) instead of moving the row's scroll
    const sec = el.closest("section")!;
    const told = (e: Event) => {
      const { cur: i, now } = (e as CustomEvent<{ cur?: number; now: boolean }>).detail;
      if (typeof i === "number") (now ? flushSync : (f: () => void) => f())(() => setCur(i));
    };
    sec.addEventListener("mt-tell", told);
    return () => {
      el.removeEventListener("scroll", onScroll);
      sec.removeEventListener("mt-tell", told);
      cancelAnimationFrame(raf);
    };
  }, []);
  React.useEffect(() => {
    row.current!.querySelectorAll(".mt-item").forEach((it, i) => it.toggleAttribute("data-on", i === cur));
  }, [cur]);
  useBackToCover();
  // the same scroll a cover as the five had in 1.5 screens
  const hold = (COVERS.length - 1) * 0.375;
  return (
    <section className="mt-held mt-covers" data-mt="covers" data-hold={hold} data-cur={cur} style={{ "--n": COVERS.length } as React.CSSProperties}>
      <div className="mt-stage">
        <div className="mt-rowhead">
          <h2>Cover art</h2>
          <p className="lbl mute mt-cvsub">Design</p>
          {/* phones name the current cover here; desktop names each one under its sleeve */}
          <p className="lbl mt-ttl mt-artist"><span className="ln"><span>{COVERS[cur].title} <span className="mute">{COVERS[cur].artist}</span></span></span></p>
          <Link className="btn mt-sm" href="/portfolio?d=coverart">See all covers</Link>
        </div>
        <div className="mt-row" ref={row} role="group" tabIndex={0} aria-label="Cover art">
          <div className="mt-track">
            {COVERS.map((c, i) => {
              const back = c.frames[1];
              return (
                <Link key={c.slug} href={coverHref(c.slug)} onClick={keepFlip} className="mt-item mt-sleeve" data-i={i} data-flip={back ? "" : undefined} style={{ "--o": 0.5, "--press": COVER_PRESS[c.slug] } as React.CSSProperties}>
                  <span className="disc" aria-hidden />
                  <div className="face">
                    <Image src={c.frames[0].src} alt={`${c.title} by ${c.artist}`} fill sizes="(max-width: 599px) 92vw, 34vw" />
                    {back ? <Image className="back" src={back.src} alt={`${c.title}, back of the sleeve`} fill sizes="34vw" /> : null}
                  </div>
                  <p className="lbl mt-cvcap" aria-hidden><span>{c.title}</span><span className="mute">{c.artist}</span></p>
                </Link>
              );
            })}
          </div>
        </div>
        <p className="mt-cvn" aria-hidden>{pad(cur + 1)}<span>/{pad(COVERS.length)}</span></p>
      </div>
    </section>
  );
}

/* Spec 3.8. Phones and tablets: the same native snap row as MtCovers. Desktop
   structure: the films stack one under another in natural scroll (motion/rows.ts
   opens the one at the middle of the screen). The current film is read here, so
   the head stays in step with the engine off too. */
export function MtFilms({ films }: { films: MtFilm[] }) {
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
        // the hold eases in and out like Cover art's, so the first and last film take more of the scroll (?mtsnap=0: even shares)
        return setCur(Math.floor((/[?&]mtsnap=0/.test(location.search) ? p : holdEase(p)) * items.length));
      }
      const a = items[0].getBoundingClientRect(), b = items[1].getBoundingClientRect();
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
    if (a instanceof HTMLElement && a.classList.contains("mt-film") && a !== items[cur] && row.current!.contains(a)) items[cur]?.focus({ preventScroll: true });
    was.current = cur;
  }, [cur]);
  const dress = FILM_DRESS[films[cur].title];
  return (
    <section className="mt-held mt-motion" data-mt="motion" data-hold={films.length * 0.25 /* a quarter screen a film */} data-cur={cur} style={{ "--n": films.length } as React.CSSProperties}>
      <div
        className="mt-stage"
        onFocus={(e) => {
          // a film taking keyboard focus before the block is held: bring the stage up, so the film and its focus mark are whole on screen
          const top = e.currentTarget.getBoundingClientRect().top;
          // straight to the first film's resting place in the hold, so the snap (motion/rows.ts) has nothing left to move (MAC, #1209)
          const sec = e.currentTarget.parentElement!, rest = /[?&]mtsnap=0/.test(location.search) || !media("fine").matches ? 0 : holdUnease(0.5 / films.length) * (sec.offsetHeight - innerHeight);
          if (top > 0 && document.documentElement.hasAttribute("data-mt-held") && (e.target as Element).matches(".mt-film:focus-visible")) scrollBy({ top: top + rest });
        }}
      >
        <div className="mt-mohead">
          <h2>Motion</h2>
          <p className="lbl mute">Director and DP | {films.length} films</p>
        </div>
        <div className="mt-row" ref={row} role="group" tabIndex={0} aria-label="Films">
          <div className="mt-track">
            {films.map((f, i) => (
              <Link key={f.id} href={f.href} className="mt-item mt-film" tabIndex={i === cur ? 0 : -1 /* only the film on screen is in the Tab order: the others lie under it */} data-i={i} data-film={f.id} data-preview={f.preview} data-file={f.file} aria-label={`${f.title}, ${f.kind}`} style={FILM_DRESS[f.title]?.zoom ? ({ "--z": FILM_DRESS[f.title]?.zoom } as React.CSSProperties) : undefined}>
                {f.poster ? <Image src={f.poster} alt="" fill sizes="(max-width: 599px) 92vw, 100vw" /> : null}
              </Link>
            ))}
          </div>
        </div>
        {/* One screen (desktop with motion): which film of the four, the client mark top right, how far through the hold. */}
        <ol className="mt-mopg lbl" aria-hidden>
          {films.map((f, i) => <li key={f.id} data-on={i === cur ? "" : undefined}>{pad(i + 1)}</li>)}
        </ol>
        {dress?.mark ? <span key={dress.mark.src} className="mt-molg" role="img" aria-label={dress.mark.name} style={{ "--m": `url(${dress.mark.src})`, "--ar": dress.mark.w / dress.mark.h } as React.CSSProperties} /> : null}
        <span className="mt-mobar" aria-hidden />
        <div className="mt-mofoot">
          <p className="lbl">{pad(cur + 1)}/{pad(films.length)}</p>
          <h3 className="mt-ttl"><span className="ln"><span>{films[cur].title}</span></span></h3>
          <p className="lbl mute">{films[cur].kind} <i aria-hidden>|</i> {films[cur].client}</p>
          <Link className="btn mt-sm" href={films[cur].href}>View more</Link>
        </div>
      </div>
    </section>
  );
}
