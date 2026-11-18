"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Marks } from "@/components/v3/duo";
import { projectHref } from "@/lib/project-href";
import { pad, type MtFrame } from "./data";

/* Spec 3.3: the gapless sheet with its heading row held on top, a counter
   and the current frame's name beside it, the client logos as its last line.
   Phone: two-column masonry, each frame at its own ratio in the shorter column. */

/** Each frame to the shorter of two columns (heights by ratio; the right one starts 56/171 of a frame lower). */
const masonry = (frames: MtFrame[]) => {
  const h = [0, 56 / 171];
  const cols: { f: MtFrame; i: number }[][] = [[], []];
  frames.forEach((f, i) => {
    const c = h[0] <= h[1] ? 0 : 1;
    cols[c].push({ f, i });
    h[c] += f.r + 0.2;
  });
  return cols;
};

export function MtCommissions({ frames }: { frames: MtFrame[] }) {
  // the first frame as served; motion/commissions.ts owns data-cur and these three lines from then on
  return (
    <section className="mt-comm" data-mt="comm" data-cur="0">
      <div className="mt-comm-pin">
      <div className="mt-comm-head">
        <h2>Commissions</h2>
        <div className="mt-comm-now" aria-hidden>
          <span className="lbl mt-count"><span className="ln"><span data-mt-count>{pad(1)}</span></span>/{pad(frames.length)}</span>
          <span className="lbl mt-cur"><span className="ln"><span data-mt-name>{frames[0].name}</span> <span className="mute">{frames[0].meta}</span></span></span>
        </div>
      </div>
      <div className="sheet mt-sheet">
        {frames.map((f, n) => (
          <figure key={f.src} data-i={n}>
            <Image src={f.src} alt={f.name} fill sizes={n === 0 ? "50vw" : "25vw"} />
            <figcaption className="lbl">
              <span>{pad(n + 1)} <span className="nm">{f.name}</span></span>
              <span className="mute">{f.meta}</span>
            </figcaption>
            <Link className="tile" href={projectHref(f.slug)} aria-label={f.name} />
          </figure>
        ))}
      </div>
      <div className="mt-comm-foot"><Link className="btn mt-comm-all" href="/portfolio">See all projects</Link></div>
      </div>
      <div className="mt-masonry">
        {masonry(frames).map((col, c) => (
          <div key={c} className="mt-mcol">
            {col.map(({ f, i }) => (
              <figure key={f.src} data-i={i}>
                <Link href={projectHref(f.slug)} className="fig">
                  <div className="ph" style={{ aspectRatio: `1 / ${f.r}` }}>
                    <Image src={f.src} alt={f.name} fill sizes="50vw" />
                  </div>
                  <figcaption className="lbl">
                    {/* the photo alt already names the frame in this link, as on the hero wall */}
                    <span aria-hidden>{f.name}</span>
                    <span className="mute">{f.meta}</span>
                  </figcaption>
                </Link>
              </figure>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-logos lbl">
        <span className="mute">Published and commissioned by</span>
        {/* Native sideways row (its touch and reduced-motion form); the drift adds a transform to .mt-logos-track. */}
        <div className="mt-logos-row" role="group" tabIndex={0} aria-label="Clients">
          <div className="mt-logos-track">
            <span className="set"><Marks /></span>
            {/* The endless loop's second copy, shown by the drift (MOTION-HOOKS.md). */}
            <span className="set" data-copy aria-hidden><Marks hidden /></span>
          </div>
        </div>
      </div>
    </section>
  );
}
