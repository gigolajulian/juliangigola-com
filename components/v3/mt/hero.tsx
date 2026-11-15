"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { projectHref } from "@/lib/project-href";
import type { MtFrame } from "./data";

/* Spec 3.2: the wall of 12 frames is the hero. Three locked columns, two
   side columns each way for wide screens (intro extras, spec 5). The name
   block sits on the first screen. Per-column lag A cycles .12 / 0 / .2.
   Wide screens (1920px and up, mtscroll.css) show five or seven columns at a
   smaller frame size, so four rows are only two screens of wall: rows five
   and six ("xr") are in the markup for them and hidden everywhere else. */
const A = [0.12, 0, 0.2];
const SIDES = [-2, -1, 3, 4];
const TOPS = [100, 290, 180];
const XR = [4, 5];
const mod3 = (c: number) => ((c % 3) + 3) % 3;

function Fig({ f, i, eager, xr }: { f: MtFrame; i: number; eager?: boolean; xr?: boolean }) {
  return (
    <figure className={xr ? "xr" : undefined} style={{ "--i": i, "--c2": i % 2, "--r2": Math.floor(i / 2) } as React.CSSProperties} data-slug={f.slug}>
      <Link href={projectHref(f.slug)} className="fig">
        <div className="ph">
          <Image src={f.src} alt={f.name} fill sizes="(max-width: 599px) 50vw, (min-width: 1920px) 18vw, 30vw" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />
        </div>
        <figcaption className="lbl">
          <span>{f.name}</span>
          <span className="mute">{f.meta}</span>
        </figcaption>
      </Link>
    </figure>
  );
}

export function MtHero({ frames, extras }: { frames: MtFrame[]; extras: MtFrame[] }) {
  // extras: 0 to 15 the side columns, 16 to 21 rows five and six of the three locked columns, 22 to 29 the same rows of the side columns
  const cols = [0, 1, 2].map((c) => ({ c, list: [...[0, 1, 2, 3].map((r) => ({ f: frames[c + r * 3], i: c + r * 3, xr: false })), ...XR.map((r) => ({ f: extras[16 + (r - 4) * 3 + c], i: c + r * 3, xr: true }))].filter((x) => x.f) }));
  const sides = SIDES.map((c, k) => ({ c, list: [...[0, 1, 2, 3].map((r) => ({ f: extras[k * 4 + r], i: -1, xr: false })), ...XR.map((r) => ({ f: extras[22 + k * 2 + (r - 4)], i: -1, xr: true }))].filter((x) => x.f) }));
  return (
    <section className="mt-hero" data-mt="hero" data-hold="1.6">
      <div className="mt-stage">
        <div className="mt-wall">
          {[...sides.slice(0, 2), ...cols, ...sides.slice(2)].map(({ c, list }) => (
            // side columns are real links too: from 1920px wide they are part of the wall for good. Where a screen hides one, visibility takes its links with it.
            <div key={c} className={c < 0 || c > 2 ? "mt-col side" : "mt-col"} data-col={c} data-a={A[mod3(c)]} style={{ "--c": c, "--top": TOPS[mod3(c)] } as React.CSSProperties}>
              {list.map(({ f, i, xr }) => (
                <Fig key={f.src} f={f} i={i} eager={i >= 0 && i < 3} xr={xr} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-name" data-mt-name>
          <div className="mt-scrim" aria-hidden />
          <div className="mt-name-in">
            <h1>Julian Gigola</h1>
            <p className="lbl mt-cap">Photographer and creative director<span className="sep"> | </span><span className="pl">San Francisco Bay Area</span></p>
          </div>
          <div className="mt-ctas">
            <Link className="btn fill" href="/contact/form">Inquire</Link>
            <Link className="btn" href="/book">Book a session</Link>
          </div>
        </div>
      </div>
      <div className="mt-more">
        <Link className="btn" href="/portfolio">See the work</Link>
      </div>
    </section>
  );
}
