"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { COVER_RELEASES } from "@/lib/cover-art-data";
import { HeldRow } from "./held-row";
import { COVER_KEYS, type MtFilm } from "./data";

const pad = (n: number) => String(n).padStart(2, "0");
const COVERS = COVER_KEYS.map((k) => COVER_RELEASES.find((r) => r.slug === k)!).filter(Boolean);

/* Spec 3.7: sleeves with a picture disc behind each. `--o` per sleeve (0 in,
   1 out) is the record's travel; the static page rests it at .5. */
export function MtCovers() {
  return (
    <HeldRow
      name="covers"
      hold={1.5}
      label="Cover art"
      count={COVERS.length}
      head={(cur) => (
        <div className="mt-rowhead">
          <p className="lbl"><span className="mute">Cover art</span> <span className="mc">{pad(cur + 1)}/{pad(COVERS.length)}</span></p>
          <h2 className="mt-ttl"><span className="ln"><span>{COVERS[cur].title}</span></span></h2>
          <p className="lbl mt-artist">{COVERS[cur].artist}</p>
          <Link className="btn mt-sm" href="/portfolio?d=coverart">See all covers</Link>
        </div>
      )}
    >
      {COVERS.map((c, i) => {
        const back = c.frames[1];
        return (
          <div key={c.slug} className="mt-item mt-sleeve" data-i={i} data-flip={back ? "" : undefined} style={{ "--o": 0.5 } as React.CSSProperties}>
            <span className="disc" aria-hidden style={{ backgroundImage: `url(${c.frames[0].thumb})` }} />
            <div className="face">
              <Image src={c.frames[0].thumb} alt={`${c.title} by ${c.artist}`} fill sizes="(max-width: 599px) 92vw, 30vw" />
              {back ? <Image className="back" src={back.thumb} alt={`${c.title}, back of the sleeve`} fill sizes="30vw" /> : null}
            </div>
          </div>
        );
      })}
    </HeldRow>
  );
}

const D = "(min-width:1024px) and (min-height:600px)";

/* Spec 3.8. Phones and tablets: the same native snap row as HeldRow. Desktop
   structure: the films stack one under another in natural scroll (motion/rows.ts
   opens the one at the middle of the screen). The current film is read here, so
   the head stays in step with the engine off too. */
export function MtMotion({ films }: { films: MtFilm[] }) {
  const row = React.useRef<HTMLDivElement>(null);
  const [cur, setCur] = React.useState(0);
  React.useEffect(() => {
    const el = row.current!;
    const items = el.querySelectorAll<HTMLElement>(".mt-item");
    const mq = matchMedia(D);
    let raf = 0;
    const read = () => {
      raf = 0;
      if (items.length < 2) return;
      const a = items[0].getBoundingClientRect(), b = items[1].getBoundingClientRect();
      // Desktop: the film nearest the middle of the screen. Elsewhere: the row's own snap step.
      const at = mq.matches ? (innerHeight / 2 - a.top - a.height / 2) / (b.top - a.top) : el.scrollLeft / (b.left - a.left);
      setCur(Math.max(0, Math.min(items.length - 1, Math.round(at))));
    };
    const on = () => (raf ||= requestAnimationFrame(read));
    el.addEventListener("scroll", on, { passive: true });
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on);
    on();
    return () => {
      el.removeEventListener("scroll", on);
      removeEventListener("scroll", on);
      removeEventListener("resize", on);
      cancelAnimationFrame(raf);
    };
  }, []);
  React.useEffect(() => {
    row.current!.querySelectorAll(".mt-item").forEach((it, i) => it.toggleAttribute("data-on", i === cur));
  }, [cur]);
  return (
    <section className="mt-held mt-motion" data-mt="motion" data-cur={cur} style={{ "--n": films.length } as React.CSSProperties}>
      <div className="mt-stage">
        <div className="mt-mohead">
          <h2>Motion</h2>
          <p className="lbl mute">Director and DP | {films.length} films</p>
        </div>
        <div className="mt-row" ref={row} tabIndex={0} aria-label="Films">
          <div className="mt-track">
            {films.map((f, i) => (
              <Link key={f.id} href={f.href} className="mt-item mt-film" data-i={i} data-film={f.id} data-preview={f.preview} aria-label={`${f.title}, ${f.kind}`}>
                {f.poster ? <Image src={f.poster} alt="" fill sizes="(max-width: 599px) 92vw, 56vw" /> : null}
              </Link>
            ))}
          </div>
        </div>
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
