"use client";

import * as React from "react";

/* ── the booking calendar's wait: J and G fill left to right ─────────
 * Julian picked E from the loader mock (2026-11-07). The count follows
 * the real load as far as there is one: it creeps toward 90 while the
 * times are asked for, and only their arrival (`done`) takes it to 100.
 * Then `onDone`, and the picker comes up. `?loader=orb` keeps the orb.
 * ─────────────────────────────────────────────────────────────── */

const CREEP = 900; // ms, how slowly the count nears 90 with no answer yet
const FINISH = 240; // ms, from wherever it is to 100 once the times are in

export function JgLoad({ done, onDone, className }: { done: boolean; onDone: () => void; className?: string }) {
  const fill = React.useRef<HTMLSpanElement>(null);
  const num = React.useRef<HTMLSpanElement>(null);
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
    const tick = (now: number) => {
      if (doneAt.current === -1) {
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
      if (shown >= 100) {
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
  }, []);

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
