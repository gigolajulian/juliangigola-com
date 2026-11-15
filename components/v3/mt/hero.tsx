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

const SIZES = "(max-width: 599px) 50vw, 30vw";

/* `was`: the frame this one replaced (idle wall). It stays under the new one until that has developed, so the swap never passes through dark. */
function Fig({ f, was, onDone, i, eager }: { f: MtFrame; was?: MtFrame; onDone?: () => void; i: number; eager?: boolean }) {
  return (
    <figure style={{ "--i": i, "--c2": i % 2, "--r2": Math.floor(i / 2) } as React.CSSProperties} data-slug={f.slug} data-i={i}>
      <Link href={projectHref(f.slug)} className="fig">
        <div className="ph">
          {was ? <Image key={was.src} src={was.src} alt="" fill sizes={SIZES} /> : null}
          <Image key={f.src} src={f.src} alt={f.name} fill sizes={SIZES} loading={eager || was ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} className={was ? "mt-dev" : undefined} onLoad={was ? (e) => e.currentTarget.setAttribute("data-on", "") : undefined} onAnimationEnd={onDone} />
        </div>
        <figcaption className="lbl">
          <span>{f.name}</span>
          <span className="mute">{f.meta}</span>
        </figcaption>
      </Link>
    </figure>
  );
}

const STILL = 4000; // idle wall: still this long before the first swap
const EVERY = 3000; // then one frame at this pace

/* Idle wall (`?idle=1`, opt-in): after 4 still seconds one wall frame on screen changes every 3 seconds for a frame
   that is not on the wall. Any pointer move, scroll, key or touch holds it. Off for reduced motion and during the splash. */
function useIdleWall(frames: MtFrame[], extras: MtFrame[]) {
  const root = React.useRef<HTMLElement>(null);
  const [now, setNow] = React.useState(frames);
  const [was, setWas] = React.useState<Record<number, MtFrame>>({});
  const live = React.useRef({ now, was, pool: extras.slice(16) }); // the first 16 extras fill the side columns
  React.useEffect(() => void Object.assign(live.current, { now, was }));
  React.useEffect(() => {
    if (!/[?&]idle=1/.test(location.search) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = performance.now(), swapped = 0;
    const touch = () => (last = performance.now());
    const evs = ["pointermove", "pointerdown", "wheel", "scroll", "keydown", "touchstart"] as const;
    evs.forEach((e) => addEventListener(e, touch, { passive: true }));
    const id = setInterval(() => {
      const t = performance.now(), L = live.current;
      if (t - last < STILL || t - swapped < EVERY || document.hidden || document.documentElement.hasAttribute("data-mt-intro") || !L.pool.length) return;
      const on = [...(root.current?.querySelectorAll<HTMLElement>("figure[data-i]") ?? [])].filter((f) => {
        const r = f.getBoundingClientRect();
        return r.width && r.top < innerHeight * 0.8 && r.bottom > innerHeight * 0.2 && !L.was[+f.dataset.i!];
      });
      if (!on.length) return;
      swapped = t;
      const i = +on[Math.floor(Math.random() * on.length)].dataset.i!;
      const next = L.pool.shift()!, old = L.now[i];
      L.pool.push(old);
      setWas((w) => ({ ...w, [i]: old }));
      setNow((n) => n.map((f, k) => (k === i ? next : f)));
    }, 500);
    return () => (clearInterval(id), evs.forEach((e) => removeEventListener(e, touch)));
  }, []);
  const done = (i: number) => setWas((w) => Object.fromEntries(Object.entries(w).filter(([k]) => +k !== i)));
  return { root, now, was, done };
}

export function MtHero({ frames: first, extras }: { frames: MtFrame[]; extras: MtFrame[] }) {
  const { root, now: frames, was, done } = useIdleWall(first, extras);
  const cols = [0, 1, 2].map((c) => ({ c, list: [0, 1, 2, 3].map((r) => ({ f: frames[c + r * 3], i: c + r * 3 })) }));
  const sides = SIDES.map((c, k) => ({ c, list: [0, 1, 2, 3].map((r) => ({ f: extras[k * 4 + r], i: -1 })).filter((x) => x.f) }));
  return (
    <section className="mt-hero" data-mt="hero" data-hold="1.6" ref={root}>
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
                <Fig key={i} f={f} was={was[i]} onDone={() => done(i)} i={i} eager={i < 3} />
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
