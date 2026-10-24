"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { V3Foot } from "@/components/v3/chrome";
import { REEL, SECTIONS, creditOf, embedUrl, inSection, posterFor, type Video } from "@/lib/videos";

/* JG V3 Video (leftovers card D): the films as 16:9 tiles in the V3 grid,
   the reel first, then each section. A tile plays its film in place on
   the click; the still is the only thing loaded before that. */

const reel: Video = { id: "reel", title: REEL.title, provider: REEL.provider, videoId: REEL.videoId, section: "music", poster: REEL.poster };

function Tile({ v, wide = false }: { v: Video; wide?: boolean }) {
  const [on, setOn] = React.useState(false);
  const poster = posterFor(v);
  const sub = [creditOf(v), v.year].filter(Boolean).join(" · ");
  return (
    <figure className={wide ? "vt wide" : "vt"}>
      <div className="ph">
        {on ? (
          <iframe src={embedUrl(v)} title={v.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        ) : (
          <button type="button" onClick={() => setOn(true)} aria-label={`Play ${v.title}`}>
            {poster ? <Image src={poster} alt="" fill sizes={wide ? "100vw" : "(max-width: 700px) 100vw, 50vw"} style={{ objectFit: "cover" }} /> : null}
            <span className="vt-play lbl" aria-hidden>Play</span>
          </button>
        )}
      </div>
      <figcaption className="lbl">
        <span>{v.title}</span>
        {sub ? <span className="mute">{sub}</span> : null}
      </figcaption>
    </figure>
  );
}

export function V3Video({ videos }: { videos: Video[] }) {
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-video">
        <div className="pg-head">
          <h1 className="pg-t">Video</h1>
          <Link className="btn" href="/portfolio">See the work</Link>
        </div>
        <div className="vgrid">
          <Tile v={reel} wide />
        </div>
        {SECTIONS.map((s) => {
          const films = inSection(videos, s.id);
          return films.length ? (
            <React.Fragment key={s.id}>
              <div className="b-head"><h2>{s.name}</h2></div>
              <div className="vgrid">
                {films.map((v) => <Tile key={v.id} v={v} />)}
              </div>
            </React.Fragment>
          ) : null;
        })}
        <V3Foot />
      </section>
    </div>
  );
}
