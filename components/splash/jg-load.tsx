"use client";

import * as React from "react";

/* ── the booking calendar's wait: J and G fill left to right ─────────
 * Julian picked E from the loader mock (2026-11-07). The count follows
 * the real load as far as there is one: it creeps toward 90 while the
 * times are asked for, and only their arrival (`done`) takes it to 100.
 * Then `onDone`, and the picker comes up. `?loader=orb` keeps the orb.
 * `?loader=split` (Julian, 2026-11-19, the Booking wait mock): J and G
 * side by side over the whole page (`jg-cover.ts`), a line under them
 * takes the count; on the answer the picker is drawn under the cover, the
 * ink drains out of the letters so they look onto the session's photo,
 * and the cut grows until the page fills the screen. Behind the flag
 * until he says ship.
 * ─────────────────────────────────────────────────────────────── */

const CREEP = 900; // ms, how slowly the count nears 90 with no answer yet
const FINISH = 240; // ms, from wherever it is to 100 once the times are in
const UP = 800; // split: the cover's J and G fading in; also the least they show
const REVEAL = 1200; // split: the cut growing until the page fills the screen
const BIG = 60; // split: how far the cut grows; the ground is gone before that
const noop = () => () => {};
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // in-out cubic, over the log of the scale

/* The cut opens: the letters become windows onto the photo, which starts
   under them, then the cut grows from inside the J's stem while the page
   scales back to its place. Once per cover; the ground is the page's own
   colour all the way, so no frame is ever black. */
function reveal(cover: HTMLElement) {
  if (cover.dataset.go) return;
  cover.dataset.go = "";
  cover.style.pointerEvents = "none";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return cover.remove();
  const ink = cover.querySelector<SVGGElement>(".ink");
  const ln = cover.querySelector<HTMLElement>(".ln");
  const mg = cover.querySelector<SVGGElement>(".mg");
  const gr = cover.querySelector<SVGRectElement>(".gr");
  const J = mg?.querySelector("text");
  if (!ink || !ln || !mg || !gr || !J) return cover.remove();
  /* Where the page starts: the photo under the letters, a touch larger. Set
     before the holes are cut, so the letters never show the page elsewhere. */
  const jb = J.getBBox();
  const ox = jb.x + jb.width * 0.74, oy = jb.y + jb.height * 0.38; // inside the J's stem
  const cx = innerWidth / 2, cy = jb.y + jb.height / 2;
  const page = document.getElementById("p-flow");
  const ph = page?.querySelector(".ph")?.getBoundingClientRect();
  const pr = page?.getBoundingClientRect();
  const seen = ph && ph.width > 0 && ph.bottom > 0 && ph.top < innerHeight;
  const pcx = seen ? ph.left + ph.width / 2 : cx, pcy = seen ? ph.top + ph.height / 2 : cy;
  const dx = cx - pcx, dy = cy - pcy;
  if (page && pr) {
    page.style.transformOrigin = `${pcx - pr.left}px ${pcy - pr.top}px`;
    page.style.willChange = "transform";
  }
  /* The ground fades while the cut is still a size Chrome draws: text past
     a few thousand px stops rendering and the whole cover flashed solid. */
  const frame = (p: number) => {
    const e = ease(p), k = Math.exp(Math.log(BIG) * e);
    mg.setAttribute("transform", `translate(${ox} ${oy}) scale(${k}) translate(${-ox} ${-oy})`);
    gr.style.opacity = String(Math.min(1, Math.max(0, 1 - (p - 0.4) / 0.45)));
    if (page) page.style.transform = `translate(${dx * (1 - e)}px, ${dy * (1 - e)}px) scale(${1.2 - 0.2 * e})`;
  };
  frame(0);
  mg.querySelectorAll("text").forEach((t) => t.setAttribute("fill", "#000"));
  ink.getAnimations().forEach((a) => a.cancel());
  ink.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, easing: "ease", fill: "forwards" });
  ln.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease", fill: "forwards" });
  window.setTimeout(() => {
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / REVEAL);
      frame(p);
      if (p < 1) return requestAnimationFrame(step);
      cover.remove();
      if (page) page.style.transform = page.style.transformOrigin = page.style.willChange = "";
    };
    requestAnimationFrame(step);
  }, 180);
}
let leaving = 0; // an unmount's reveal, held a moment in case the effect is only re-run

export function JgLoad({ done, onDone, className }: { done: boolean; onDone: () => void; className?: string }) {
  const fill = React.useRef<HTMLSpanElement>(null);
  const num = React.useRef<HTMLSpanElement>(null);
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
    const cover = split ? document.getElementById("jg-cover") : null;
    window.clearTimeout(leaving);
    const start = performance.now();
    // the cover went up as the page was read: its least time counts from then
    const shownFrom = cover ? Number(cover.dataset.at) || start : start;
    const bar = cover?.querySelector<HTMLElement>(".ln u");
    if (cover) {
      // the line as wide as J and G themselves, not the guess the markup starts with
      const [j, g] = cover.querySelectorAll<SVGTextElement>(".ink text");
      const ln = bar?.parentElement;
      if (j && g && ln) {
        const a = j.getBBox(), b = g.getBBox();
        Object.assign(ln.style, { left: `${a.x}px`, width: `${b.x + b.width - a.x}px`, transform: ln.style.transform.replace("-50%", "0px") });
      }
    }
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
  }, [split]);

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
