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

/* Spec 3.8: the film row, posters only; the embed loads on the film's own page. */
export function MtMotion({ films }: { films: MtFilm[] }) {
  return (
    <HeldRow
      name="motion"
      hold={2.5}
      label="Films"
      count={films.length}
      head={() => (
        <div className="mt-mohead">
          <h2>Motion</h2>
          <p className="lbl mute">Director and DP | {films.length} films</p>
        </div>
      )}
      foot={(cur) => (
        <div className="mt-mofoot">
          <p className="lbl">{pad(cur + 1)}/{pad(films.length)}</p>
          <h3 className="mt-ttl"><span className="ln"><span>{films[cur].title}</span></span></h3>
          <p className="lbl mute">{films[cur].kind} <i>|</i> {films[cur].client}</p>
          <Link className="btn mt-sm" href={films[cur].href}>View more</Link>
        </div>
      )}
    >
      {films.map((f, i) => (
        <Link key={f.id} href={f.href} className="mt-item mt-film" data-i={i} data-film={f.id} aria-label={`${f.title}, ${f.kind}`}>
          {f.poster ? <Image src={f.poster} alt="" fill sizes="(max-width: 599px) 92vw, 50vw" /> : null}
        </Link>
      ))}
    </HeldRow>
  );
}
