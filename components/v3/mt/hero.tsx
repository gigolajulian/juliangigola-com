"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { matches } from "@/lib/device";
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

const SIZES = "(max-width: 599px) 50vw, (min-width: 1920px) 18vw, 30vw";

/* The card turn (motion/hero.ts sets html[data-mt-flip] to the flip's ms): the caption changes as the card is edge-on. The move curve is not symmetric: it passes 90 degrees at 0.479 of its time. The timer starts on animationstart, which arrives a frame after the animation began (measured): hence the 16ms off. */
const EDGE = 0.479;
const flipMs = () => Number(document.documentElement.dataset.mtFlip) || 0;

/* `was`: the frame this one replaced (idle wall). It stays under the new one until that has loaded and cut in, so the swap never passes through dark. */
function Fig({ f, was, onDone, i, eager, xr, idle }: { f: MtFrame; was?: MtFrame; onDone?: () => void; i: number; eager?: boolean; xr?: boolean; idle?: boolean }) {
  // the caption changes with the photo: the new frame's name waits until its image has loaded and cut in (it led by about 170ms)
  const [shown, setShown] = React.useState(f.src);
  const cap = was && shown !== f.src ? was : f;
  return (
    <figure className={xr ? "xr" : undefined} style={{ "--i": i, "--c2": i % 2, "--r2": Math.floor(i / 2) } as React.CSSProperties} data-slug={f.slug} data-i={idle ? i : undefined}>
      <Link href={projectHref(f.slug)} className="fig">
        <div className="ph">
          {was ? <Image key={was.src} src={was.src} alt="" fill sizes={SIZES} /> : null}
          <Image key={f.src} src={f.src} alt={f.name} fill sizes={SIZES} loading={eager || was ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} className={was ? "mt-dev" : undefined} onLoad={was ? (e) => (e.currentTarget.setAttribute("data-on", ""), flipMs() || setShown(f.src)) : undefined} onAnimationStart={was ? () => flipMs() && setTimeout(() => setShown(f.src), flipMs() * EDGE - 16) : undefined} onAnimationEnd={onDone} />
        </div>
        <figcaption className="lbl">
          {/* the photo alt already names the frame in this link, so a screen reader hears it once */}
          <span aria-hidden>{cap.name}</span>
          <span className="mute">{cap.meta}</span>
        </figcaption>
      </Link>
    </figure>
  );
}

/* The tagline, a span a letter inside a span a word (a word never breaks across lines). */
const letters = (t: string) => t.split(" ").map((word, n) => (
  <React.Fragment key={n}>{n ? " " : null}<span className="wd">{[...word].map((ch, k) => <span key={k} className="w">{ch}</span>)}</span></React.Fragment>
));

const STILL = 4000; // idle wall: still this long before the first swap
const EVERY = 2500; // then one frame at this pace

/* Idle wall (the V4 default since 2026-11-15, `?idle=0` turns it off): after 4 still seconds one of the 12 locked frames on screen changes every 2.5 seconds
   for a frame that is not on the wall. Any pointer move, scroll, key or touch holds it. Off for reduced motion and during the splash. */
function useIdleWall(frames: MtFrame[], extras: MtFrame[]) {
  const root = React.useRef<HTMLElement>(null);
  const [now, setNow] = React.useState(frames);
  const [was, setWas] = React.useState<Record<number, MtFrame>>({});
  const live = React.useRef({ now, was, pool: extras.slice(30) }); // the first 30 extras are on the wall (side columns, rows five and six)
  React.useEffect(() => void Object.assign(live.current, { now, was }));
  React.useEffect(() => {
    if (/[?&]idle=0/.test(location.search) || matches("calm")) return;
    let last = performance.now(), swapped = 0;
    const touch = () => (last = performance.now());
    const evs = ["pointermove", "pointerdown", "wheel", "scroll", "keydown", "touchstart"] as const;
    evs.forEach((e) => addEventListener(e, touch, { passive: true }));
    const id = setInterval(() => {
      const t = performance.now(), L = live.current;
      if (document.documentElement.hasAttribute("data-mt-intro")) return void (last = t); // the 4 still seconds start when the splash lifts
      if (t - last < STILL || t - swapped < EVERY || document.hidden || !L.pool.length) return;
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
  // extras: 0 to 15 the side columns, 16 to 21 rows five and six of the three locked columns, 22 to 29 the same rows of the side columns
  const cols = [0, 1, 2].map((c) => ({ c, list: [...[0, 1, 2, 3].map((r) => ({ f: frames[c + r * 3], i: c + r * 3, xr: false })), ...XR.map((r) => ({ f: extras[16 + (r - 4) * 3 + c], i: c + r * 3, xr: true }))].filter((x) => x.f) }));
  const sides = SIDES.map((c, k) => ({ c, list: [...[0, 1, 2, 3].map((r) => ({ f: extras[k * 4 + r], i: -1, xr: false })), ...XR.map((r) => ({ f: extras[22 + k * 2 + (r - 4)], i: -1, xr: true }))].filter((x) => x.f) }));
  return (
    <section className="mt-hero" data-mt="hero" data-hold="1.6" ref={root}>
      <div className="mt-stage">
        {/* Before the wall in the DOM so Tab reaches Inquire and Book a session first, while the name is still on screen (it is hidden once scrolled away). z-index keeps it painted over the wall. */}
        <div className="mt-name" data-mt-name>
          <div className="mt-scrim" aria-hidden />
          <div className="mt-name-in">
            <h1>Julian Gigola</h1>
            {/* a span a letter: each takes white, black or grey from what is under it (tone() in motion/hero.ts). Screen readers get the line once, as plain text. */}
            <p className="lbl mt-cap">
              <span className="sr-only">Photographer and creative director, San Francisco Bay Area</span>
              <span aria-hidden>{letters("Photographer and creative director")} <span className="sep w">| </span><span className="pl">{letters("San Francisco Bay Area")}</span></span>
            </p>
          </div>
          <div className="mt-ctas">
            <Link className="btn fill" href="/contact/form">Inquire</Link>
            <Link className="btn" href="/book">Book a session</Link>
          </div>
        </div>
        <div className="mt-wall">
          {[...sides.slice(0, 2), ...cols, ...sides.slice(2)].map(({ c, list }) => (
            // side columns are real links too: from 1920px wide they are part of the wall for good. Where a screen hides one, visibility takes its links with it.
            <div key={c} className={c < 0 || c > 2 ? "mt-col side" : "mt-col"} data-col={c} data-a={A[mod3(c)]} style={{ "--c": c, "--top": TOPS[mod3(c)] } as React.CSSProperties}>
              {list.map(({ f, i, xr }) => (i >= 0 && !xr ? (
                <Fig key={i} f={f} was={was[i]} onDone={() => done(i)} i={i} eager={i < 3} idle />
              ) : (
                <Fig key={f.src} f={f} i={i} xr={xr} />
              )))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-more">
        <Link className="btn" href="/portfolio">See the work</Link>
      </div>
    </section>
  );
}
