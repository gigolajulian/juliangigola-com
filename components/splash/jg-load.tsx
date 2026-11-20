"use client";

import * as React from "react";

/* ── the booking calendar's wait: J and G fill left to right ─────────
 * Julian picked E from the loader mock (2026-11-07). The count follows
 * the real load as far as there is one: it creeps toward 90 while the
 * times are asked for, and only their arrival (`done`) takes it to 100.
 * Then `onDone`, and the picker comes up. `?loader=orb` keeps the orb.
 * The default on the booking pages (Julian, 2026-11-19, the Booking wait
 * mock, "make it the default"; `?loader=fill` keeps the fill): J and G
 * side by side over the whole page (`jg-cover.ts`), a line under them
 * takes the count; on the answer the picker is drawn under the cover and
 * the cut grows from the middle of the mark until the page, standing
 * still, fills the screen.
 * ─────────────────────────────────────────────────────────────── */

const CREEP = 900; // ms, how slowly the count nears 90 with no answer yet
const FINISH = 240; // ms, from wherever it is to 100 once the times are in
const UP = 800; // split: the cover's J and G fading in; also the least they show
const REVEAL = 1200; // split: the cut growing until the page fills the screen
const BIG = 60; // split: how far the cut grows; the ground is gone before that
const noop = () => () => {};
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // in-out cubic, over the log of the scale

/* The cut opens: J and G close over the middle, the cut grows from where
   they meet while their ink fades, and the page rises into place from
   below, straight up on every screen (Julian, 2026-11-19: the phone's rise
   "is good", the desktop's "needs to come from bottom up"; it slid in from
   the side). It lands as the ground finishes fading, so nothing is still
   settling once the cover is gone ("keep it steady"). Once per cover; the
   ground is the page's own colour all the way, so no frame is black. */
function reveal(cover: HTMLElement) {
  if (cover.dataset.go) return;
  cover.dataset.go = "";
  cover.style.pointerEvents = "none";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return cover.remove();
  const ink = cover.querySelector<SVGGElement>(".ink");
  const ln = cover.querySelector<HTMLElement>(".ln");
  const mg = cover.querySelector<SVGGElement>(".mg");
  const gr = cover.querySelector<SVGRectElement>(".gr");
  if (!ink || !ln || !mg || !gr) return cover.remove();
  // where J meets G, the middle of the mark, in the middle of the screen (`jg-cover.ts`)
  const ox = Number(cover.dataset.ox) || innerWidth / 2, oy = Number(cover.dataset.oy) || innerHeight / 2;
  const close = Number(cover.dataset.close) || 0;
  /* From below: the session photo's middle under the mark where the layout
     allows (a phone, the photo on top), a fifth of the screen at least. */
  const page = document.getElementById("p-flow");
  const ph = page?.querySelector(".ph")?.getBoundingClientRect();
  const pr = page?.getBoundingClientRect();
  const rise = Math.max(innerHeight * 0.2, ph && ph.height > 0 ? oy - (ph.top + ph.height / 2) : 0);
  if (page && pr) {
    page.style.transformOrigin = `${ox - pr.left}px ${oy - pr.top}px`;
    page.style.willChange = "transform";
  }
  const settle = (p: number) => {
    if (!page) return;
    // a touch smaller to its size, never larger: scaled up, the page scrolled sideways while it settled (QA: 147px at 1440)
    const e = ease(Math.min(1, p / 0.85));
    page.style.transform = e < 1 ? `translateY(${rise * (1 - e)}px) scale(${0.94 + 0.06 * e})` : "";
  };
  /* The ink stays in the letters until they are big enough to show the page
     (a small window onto it reads as an empty letter), and the ground fades
     while the cut is still a size Chrome draws: text past a few thousand px
     stops rendering and the whole cover flashed solid. */
  const frame = (p: number) => {
    const e = ease(p), k = Math.exp(Math.log(BIG) * e);
    mg.setAttribute("transform", `translate(${ox} ${oy}) scale(${k}) translate(${-ox} ${-oy})`);
    ink.setAttribute("transform", `translate(${ox} ${oy}) scale(${k}) translate(${-ox} ${-oy})`);
    // fades between 4 and 10 times its size: by then the letters show a good piece of the page on any screen (JG - MAC: at 1440 they read empty over the dark calendar)
    ink.style.opacity = String(Math.min(1, Math.max(0, (10 - k) / 6)));
    gr.style.opacity = String(Math.min(1, Math.max(0, 1 - (p - 0.4) / 0.45)));
    settle(p);
  };
  ink.getAnimations().forEach((a) => a.cancel());
  frame(0);
  mg.querySelectorAll("text").forEach((t) => t.setAttribute("fill", "#000"));
  ln.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease", fill: "forwards" });
  // J and G close over the middle first, so the point the cut grows from is inside a letter, not the gap
  const texts = [...cover.querySelectorAll<SVGTextElement>("text")].map((t) => ({ t, x: Number(t.getAttribute("x")), dir: t.classList.contains("j") ? 1 : -1 }));
  const t0 = performance.now();
  const step = (now: number) => {
    const c = Math.min(1, (now - t0) / 240), ce = 1 - (1 - c) ** 3;
    for (const { t, x, dir } of texts) t.setAttribute("x", String(x + dir * close * ce));
    const p = Math.min(1, Math.max(0, (now - t0 - 120) / REVEAL));
    frame(p);
    if (p < 1) return requestAnimationFrame(step);
    cover.remove();
    if (page) page.style.transform = page.style.transformOrigin = page.style.willChange = "";
  };
  requestAnimationFrame(step);
}
let leaving = 0; // an unmount's reveal, held a moment in case the effect is only re-run

export function JgLoad({ done, onDone, className }: { done: boolean; onDone: () => void; className?: string }) {
  const fill = React.useRef<HTMLSpanElement>(null);
  const num = React.useRef<HTMLSpanElement>(null);
  // the cover is up (a booking page with a calendar, `jg-cover.ts`): it plays the wait; anywhere else, J and G fill
  const split = React.useSyncExternalStore(noop, () => !!document.getElementById("jg-cover"), () => false);
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
    // read here, not from the render: after a move inside the site the page puts the cover up in a layout effect, after this rendered (v3/book.tsx)
    const cover = document.getElementById("jg-cover");
    window.clearTimeout(leaving);
    const start = performance.now();
    // the cover went up as the page was read: its least time counts from then
    const shownFrom = cover ? Number(cover.dataset.at) || start : start;
    const bar = cover?.querySelector<HTMLElement>(".ln u");
    let from = 0;
    let shown = 0;
    let raf = 0;
    let fired = false;
    const tick = (now: number) => {
      if (doneAt.current === -1 && (!cover || still || now - shownFrom >= UP)) {
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
      if (bar) bar.style.transform = `scaleX(${shown / 100})`;
      if (shown >= 100) {
        if (!fired) {
          fired = true;
          if (cover) {
            // the picker is drawn under the cover first, then the cut opens onto it
            last.current();
            requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(() => reveal(cover), 60)));
          } else window.setTimeout(() => last.current(), still ? 0 : 120); // a beat on the full mark before the calendar takes its place
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      // gone without an answer (the fallback took over): the cover opens onto whatever the page shows
      if (cover && !fired) leaving = window.setTimeout(() => reveal(cover), 50);
    };
  }, []);

  if (split) return <div role="status" className={className}><span className="sr-only">Loading availability</span></div>;
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
