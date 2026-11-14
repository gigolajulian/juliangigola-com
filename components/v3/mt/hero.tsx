"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { projectHref } from "@/lib/project-href";
import type { MtFrame } from "./data";

/* Spec 3.2: the wall of 12 frames is the hero. Three locked columns, two
   side columns each way for wide screens (intro extras, spec 5). The name
   block sits on the first screen. Per-column lag A cycles .12 / 0 / .2. */
const A = [0.12, 0, 0.2];
const SIDES = [-2, -1, 3, 4];
const TOPS = [100, 290, 180];
const mod3 = (c: number) => ((c % 3) + 3) % 3;

function Fig({ f, i, eager }: { f: MtFrame; i: number; eager?: boolean }) {
  return (
    <figure style={{ "--i": i, "--c2": i % 2, "--r2": Math.floor(i / 2) } as React.CSSProperties} data-slug={f.slug}>
      <Link href={projectHref(f.slug)} className="fig">
        <div className="ph">
          <Image src={f.src} alt={f.name} fill sizes="(max-width: 599px) 50vw, 30vw" loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />
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
  const cols = [0, 1, 2].map((c) => ({ c, list: [0, 1, 2, 3].map((r) => ({ f: frames[c + r * 3], i: c + r * 3 })) }));
  const sides = SIDES.map((c, k) => ({ c, list: [0, 1, 2, 3].map((r) => ({ f: extras[k * 4 + r], i: -1 })).filter((x) => x.f) }));
  return (
    <section className="mt-hero" data-mt="hero" data-hold="2.1">
      <div className="mt-stage">
        <div className="mt-wall">
          {[...sides.slice(0, 2), ...cols, ...sides.slice(2)].map(({ c, list }) => (
            <div key={c} className={c < 0 || c > 2 ? "mt-col side" : "mt-col"} data-col={c} data-a={A[mod3(c)]} style={{ "--c": c, "--top": TOPS[mod3(c)] } as React.CSSProperties} aria-hidden={c < 0 || c > 2 || undefined}>
              {list.map(({ f, i }) => (c < 0 || c > 2 ? (
                <figure key={f.src} data-slug={f.slug}>
                  <div className="ph"><Image src={f.src} alt="" fill sizes="30vw" /></div>
                  <figcaption className="lbl"><span>{f.name}</span><span className="mute">{f.meta}</span></figcaption>
                </figure>
              ) : (
                <Fig key={f.src} f={f} i={i} eager={i < 3} />
              )))}
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
