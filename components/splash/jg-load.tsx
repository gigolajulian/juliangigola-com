"use client";

import * as React from "react";

/* ── the booking calendar's wait: J and G fill left to right ─────────
 * Julian picked E from the loader mock (2026-11-07). The count follows
 * the real load as far as there is one: it creeps toward 90 while the
 * times are asked for, and only their arrival (`done`) takes it to 100.
 * Then `onDone`, and the picker comes up. `?loader=orb` keeps the orb.
 * `?loader=split` (Julian, 2026-11-19, "jg NEXT TO EACH OTHER"): J and
 * G fade in side by side as on the homepage splash, a line under them
 * takes the same count, and on the answer J lifts away up, G drops away
 * down. Behind the flag until he says ship.
 * ─────────────────────────────────────────────────────────────── */

const CREEP = 900; // ms, how slowly the count nears 90 with no answer yet
const FINISH = 240; // ms, from wherever it is to 100 once the times are in
const UP = 800; // split: J and G fading in, as the homepage splash (`split-splash.ts`); also the least they show
const PART = 700; // split: J up and G down, out of the box
const MOVE = "cubic-bezier(0.77, 0, 0.175, 1)"; // `--ease-move`
const noop = () => () => {};

export function JgLoad({ done, onDone, className }: { done: boolean; onDone: () => void; className?: string }) {
  const fill = React.useRef<HTMLSpanElement>(null);
  const num = React.useRef<HTMLSpanElement>(null);
  const j = React.useRef<HTMLSpanElement>(null);
  const g = React.useRef<HTMLSpanElement>(null);
  const bar = React.useRef<HTMLSpanElement>(null);
  const split = React.useSyncExternalStore(noop, () => new URLSearchParams(location.search).get("loader") === "split", () => false);
  const last = React.useRef(onDone);
  React.useEffect(() => {
    last.current = onDone;
  });
  const doneAt = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (done && doneAt.current === null) doneAt.current = -1; // stamped on the next frame
  }, [done]);

  React.useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let from = 0;
    let shown = 0;
    let raf = 0;
    let fired = false;
    if (split && !still) for (const el of [j.current, g.current]) el?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: UP, easing: "ease", fill: "backwards" });
    const tick = (now: number) => {
      // split: the mark stays up at least its fade, so a quick answer never blinks
      if (doneAt.current === -1 && (!split || still || now - start >= UP)) {
        doneAt.current = now;
        from = shown;
      }
      if (doneAt.current === null) shown = 90 * (1 - Math.exp(-(now - start) / CREEP));
      else {
        const k = still ? 1 : Math.min(1, (now - doneAt.current) / FINISH);
        shown = from + (100 - from) * (1 - (1 - k) ** 3);
      }
      if (fill.current) fill.current.style.clipPath = `inset(0 ${100 - shown}% 0 0)`;
      if (num.current) num.current.textContent = String(Math.round(shown)).padStart(3, "0");
      if (bar.current) bar.current.style.transform = `scaleX(${shown / 100})`;
      if (shown >= 100) {
        if (!fired && split) {
          fired = true;
          if (still) last.current();
          else {
            const out = (el: HTMLElement | null, y: string) =>
              el?.animate([{ transform: "none", opacity: 1 }, { transform: `translateY(${y})`, opacity: 0 }], { duration: PART, easing: MOVE, fill: "forwards" });
            out(j.current, "-120%");
            out(g.current, "120%");
            bar.current?.parentElement?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
            window.setTimeout(() => last.current(), PART);
          }
        }
        if (!fired) {
          fired = true;
          // a beat on the full mark before the calendar takes its place
          window.setTimeout(() => last.current(), still ? 0 : 120);
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [split]);

  if (split)
    return (
      <div role="status" className={`flex items-center justify-center overflow-hidden ${className ?? ""}`}>
        <span aria-hidden className="pointer-events-none flex select-none flex-col items-stretch text-[7.5rem] leading-[0.8] tracking-[-0.05em] [font-family:var(--font-display)] font-black">
          <span className="flex justify-center gap-[0.04em]">
            <span ref={j} className="block">J</span>
            <span ref={g} className="block">G</span>
          </span>
          <span className="mt-[0.22em] block h-[2px] bg-[color-mix(in_srgb,currentColor_18%,transparent)]">
            <span ref={bar} className="block h-full origin-left bg-current" style={{ transform: "scaleX(0)" }} />
          </span>
        </span>
        <span className="sr-only">Loading availability</span>
      </div>
    );
  const mark = "pointer-events-none select-none whitespace-nowrap text-[5rem] leading-[0.74] tracking-[-0.05em] [font-family:var(--font-display)] font-black";
  return (
    <div role="status" className={`flex flex-col items-center justify-center gap-5 ${className ?? ""}`}>
      <span aria-hidden className="relative block">
        <span className={`${mark} block opacity-[0.14]`}>JG</span>
        <span ref={fill} className={`${mark} absolute inset-0 block`} style={{ clipPath: "inset(0 100% 0 0)" }}>JG</span>
      </span>
      <span className="label lbl flex gap-3.5">
        <span className="opacity-60">Loading availability</span>
        <span ref={num} aria-hidden className="tabular-nums text-[var(--accent)]">000</span>
      </span>
    </div>
  );
}
