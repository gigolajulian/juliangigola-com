import * as React from "react";
import { warmGsap, withGsap } from "@/lib/gsap-lazy";
import { iso, overflowOf, STEP_AT, type PickedTime, type Slot, type Step } from "@/components/booking/time-picker-parts";

type Layout = {
  step: Step;
  pick: PickedTime | null;
  days: Record<string, Slot[]> | null;
  view: "week" | "month";
  anchor: Date;
  week: Date[];
  month: (Date | null)[];
  chosen: false | "day" | "time";
  mstep: "days" | "times";
  held: boolean;
  state: "loading" | "ready" | "fallback";
  atStart: boolean;
  shift: (dir: number) => void;
};

/* The picker on the page (`use-picker.tsx`): its boxes, each card fitted
   to its room, the steps, times and days coming in, and the swipe across
   the days. The effects keep the order they had there. */
export function usePickerLayout({ step, pick, days, view, anchor, week, month, chosen, mstep, held, state, atStart, shift }: Layout) {
  const [stripEl, stripRef] = React.useState<HTMLDivElement | null>(null);
  const [more, setMore] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  const v3root = React.useRef<HTMLDivElement>(null); // the V3 stepper's own, so root's slide motion stays editorial-card only
  const was = React.useRef(step);
  React.useEffect(warmGsap, []);
  React.useLayoutEffect(() => {
    const dir = Math.sign(STEP_AT[step] - STEP_AT[was.current]);
    was.current = step;
    const el = root.current;
    // A step opens at its top: on an iPhone Details opened where Continue
    // had been, Name and Email above the screen (JG - MAC, 2026-10-17).
    const card = el?.matches(".ed") ? el : el?.querySelector<HTMLElement>(".ed");
    if (dir && card && card.getBoundingClientRect().top < 0) card.scrollIntoView({ block: "start" });
    // Back to the taller Time step keeps You's scroll too; FlowShell only sees forward steps.
    const rail = v3root.current?.querySelector<HTMLElement>(".rail");
    if (dir < 0 && rail && rail.getBoundingClientRect().top < 64) rail.scrollIntoView({ block: "start" });
    if (!dir || !el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Booked rises in; any other step slides in from the side it comes from.
    const up = step === "done";
    withGsap((gsap) => gsap.fromTo(
      el.querySelectorAll(".ed-l > *, .ed-r > *, .ed-floor"),
      { autoAlpha: 0, x: up ? 0 : 28 * dir, y: up ? 14 : 0 },
      { autoAlpha: 1, x: 0, y: 0, duration: 0.5, ease: "expo.out", stagger: 0.035, clearProps: "opacity,visibility,transform" },
    ));
  }, [step]);
  /* A day picked in a month brings its times up on a phone, where the
     card is as tall as it needs and the page scrolls. */
  const showTimes = () =>
    requestAnimationFrame(() => {
      const box = slotsBox.current;
      if (!box?.offsetParent || !matchMedia("(max-width: 39.99rem)").matches) return;
      const r = box.getBoundingClientRect();
      if (r.top > innerHeight * 0.6) scrollBy({ top: r.top - innerHeight * 0.25, behavior: "smooth" });
    });
  const swipe = React.useRef<{ x: number; y: number; done: boolean; drag?: boolean; v?: number; t?: number; lx?: number } | null>(null);
  /* Week and month trade places as one set of cards: each day glides from
     where it stood to where it lands and the box eases to its new height,
     a day that was not on show fades in. Measured before the switch,
     played once the new view is laid out. */
  const daysBox = React.useRef<HTMLDivElement>(null);
  /* A month as tall as the picker has room for: past it, the confirm bar
     sat over the ruler (six rows, or a short window). The cells give up
     what the picker overflows by, shared between the rows. */
  const monthGrid = React.useRef<HTMLDivElement>(null);
  /* And a week: its big time gives up what the picker overflows by (the
     times in kinds took a row more, past an iPad held sideways). */
  const big = React.useRef<HTMLDivElement>(null);
  /* The times' width: they keep to one line while every box has room for
     its time (Julian: a day of half hours was crammed). */
  /* The time picked kept in view in option B's row, and the fade and hint
     only while times run past its edge. */
  React.useEffect(() => {
    // The row mounts after the times arrive (a state ref, not useRef, so this runs then).
    const ix = stripEl;
    if (!ix) return;
    const on = ix.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (on && (on.offsetLeft < ix.scrollLeft || on.offsetLeft + on.offsetWidth > ix.scrollLeft + ix.clientWidth)) ix.scrollTo({ left: Math.max(0, on.offsetLeft - on.offsetWidth) });
    const fit = () => setMore(ix.scrollLeft + ix.clientWidth < ix.scrollWidth - 4);
    fit();
    // The row's own box keeps its width as the times grow or the fonts land: watch the buttons too.
    const ro = new ResizeObserver(fit);
    ro.observe(ix);
    for (const b of ix.children) ro.observe(b);
    void document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [stripEl, pick?.date, pick?.min, days, step]);
  const slotsBox = React.useRef<HTMLDivElement>(null);
  const [slotsW, setSlotsW] = React.useState(0);
  /* Watched by whichever box is drawn now: one replaced under the old
     observer read 0 as it left, and the times stacked one to a line under
     Confirm. Hidden (0) keeps the last width. */
  const slotsRO = React.useRef<ResizeObserver | null>(null);
  const slotsRef = React.useCallback((el: HTMLDivElement | null) => {
    slotsRO.current?.disconnect();
    slotsBox.current = el;
    if (!el) return;
    slotsRO.current = new ResizeObserver(() => el.clientWidth && setSlotsW(el.clientWidth));
    slotsRO.current.observe(el);
  }, []);
  React.useLayoutEffect(() => {
    const el = big.current;
    const tp = el?.closest<HTMLElement>(".tp");
    if (view !== "week" || !el || !tp) return;
    const row = el.parentElement!;
    const block = row.parentElement!;
    // The spare height around it (Julian's spacers) goes with it, or its
    // room stayed as an empty band (audit, 2026-10-11).
    const over = block.previousElementSibling as HTMLElement | null;
    const under = block.nextElementSibling as HTMLElement | null;
    const fit = () => {
      el.style.removeProperty("font-size");
      row.style.removeProperty("display");
      block.style.removeProperty("display");
      over?.style.removeProperty("display");
      under?.style.removeProperty("max-height");
      tp.removeAttribute("data-tight");
      tp.removeAttribute("data-split");
      // Twice: the line it sits on does not give back all it shrinks by.
      for (let i = 0; i < 2; i++) {
        const over = overflowOf(tp);
        if (over > 0) el.style.fontSize = `${Math.max(48, parseFloat(getComputedStyle(el).fontSize) - over / 0.85)}px`;
      }
      // Smaller than that it is not worth its row: the day over it and the
      // time picked below say the same, as under a month.
      if (overflowOf(tp) > 0) row.style.display = "none";
      // Still over (a day of half hours on an iPad held sideways): the day
      // goes too, the bar under the times says it.
      if (overflowOf(tp) > 0) {
        block.style.display = "none";
        if (over) over.style.display = "none";
        under?.style.setProperty("max-height", "var(--tp-gap, 2rem)");
      }
      // Still over (half-hour calls at 1280x720): the steps' names go and
      // the times close up (`[data-tight]`, contact.css).
      if (overflowOf(tp) > 0) tp.setAttribute("data-tight", "");
      // Still over on a short window (a phone on its side, a laptop or an
      // iPad at 600 tall, where the times ran under Confirm): the week, then
      // the day's times in its place, as a month that does not fit
      // (`data-split`). Not on a tall one: /book at 1440x900 is over too
      // before a day is picked, and split there it lost its Confirm bar
      // (CI on #134).
      if (overflowOf(tp) > 0 && matchMedia("(max-height: 40rem) and (min-width: 40rem)").matches) tp.setAttribute("data-split", "");
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(tp);
    /* Back from the form (Change) the steps slide open (grid rows) and it
       was measured mid-slide, saw room, and kept the big time full height
       over the times: fitted again when the slide lands (Julian). */
    const landed = (e: TransitionEvent) => e.propertyName === "grid-template-rows" && fit();
    tp.addEventListener("transitionend", landed);
    return () => {
      ro.disconnect();
      tp.removeEventListener("transitionend", landed);
      tp.removeAttribute("data-tight");
      tp.removeAttribute("data-split");
    };
  }, [view, pick?.date, days, slotsW, mstep, held]);
  const at = pick?.start;
  const refit = React.useRef(() => {});
  React.useLayoutEffect(() => {
    const grid = monthGrid.current;
    const tp = grid?.closest<HTMLElement>(".tp");
    if (view !== "month" || !grid || !tp) return;
    // The fold the days sit in can shrink and hide what does not fit, so
    // its own overflow counts as well as the picker's.
    const fold = grid.closest<HTMLElement>(".min-h-0.overflow-hidden");
    const overBy = () => Math.max(overflowOf(tp), fold ? fold.scrollHeight - fold.clientHeight : 0);
    const rows = Math.ceil((grid.children.length - 7) / 7);
    /* The cells give up what the picker is over by, down to `least`. */
    const squeeze = (least: number) => {
      grid.style.removeProperty("--cell-h");
      const cell = grid.querySelector<HTMLElement>("[data-day]");
      if (!cell?.offsetHeight) return 0;
      // Twice, for what the first pass leaves over by rounding.
      for (let i = 0; i < 2; i++) {
        const over = overBy();
        if (over <= 0) return 0;
        grid.style.setProperty("--cell-h", `${Math.max(least, cell.offsetHeight - Math.ceil(over / rows))}px`);
      }
      return overBy();
    };
    const fit = () => {
      /* Not while the days glide to the month (below): the box they sit in
         is short until it lands and its hidden overflow squeezed the cells
         to nothing. Fitted again when it lands (`refit`). */
      if (daysBox.current?.getAnimations().length) return;
      tp.removeAttribute("data-split");
      // Both, while a cell keeps 2.5rem: under it they were strips.
      if (squeeze(40) <= 0) return;
      tp.setAttribute("data-split", "");
      squeeze(28);
    };
    fit();
    refit.current = fit;
    const ro = new ResizeObserver(fit);
    ro.observe(tp);
    return () => {
      ro.disconnect();
      refit.current = () => {};
      tp.removeAttribute("data-split");
    };
  }, [view, month, pick?.date, days, mstep, held]);
  /* Editorial: the card never scrolls. Over by anything, it closes up a
     step at a time (`data-fit`, editorial.css): a smaller time, no big
     time, then the days and the times as two screens. */
  React.useLayoutEffect(() => {
    const el = root.current;
    const body = el?.querySelector<HTMLElement>(".ed-body");
    if (step !== "pick" || !el || !body) return;
    const fit = () => {
      el.removeAttribute("data-scroll");
      /* Measured two ways: WebKit reported no scroll while the month's
         last week sat under the floor (MAC on #279, 2026-10-21), so the
         month's own bottom is checked against the body's as well. */
      const over = () => {
        const month = body.querySelector(".ed-month, .ed-days");
        const past = month ? month.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom : 0;
        return Math.max(body.scrollHeight - body.clientHeight, past);
      };
      el.style.removeProperty("--ed-cell");
      for (let n = 0; n <= 3; n++) {
        el.dataset.fit = String(n);
        if (over() <= 1) {
          /* A wide card with room to spare: the
             month's cells grow into it, a quarter rem at a time. */
          if (n === 0 && view === "month" && el.clientWidth >= 640) {
            let kept = 3.125;
            for (let r = 3.375; r <= 5.5; r += 0.25) {
              el.style.setProperty("--ed-cell", r + "rem");
              if (over() > 1) break;
              kept = r;
            }
            el.style.setProperty("--ed-cell", kept + "rem");
          }
          return;
        }
      }
      // Still over at the last step (a phone on its side, QA on #204): the
      // days were clipped out of reach. Reachable beats no scroll.
      el.dataset.scroll = "";
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step, view, month, week, pick?.date, chosen, days, mstep, held]);
  /* Split in two and scrolling, each screen opens at its top: the times
     opened where the days had been scrolled to, their way back hidden. */
  React.useLayoutEffect(() => {
    const body = root.current?.querySelector<HTMLElement>(".ed-body");
    if (body) body.scrollTop = 0;
  }, [mstep]);
  /* Editorial: the days cascade in, left to right across a week, a ripple from the top left of a month.
     On every week or month shown, but not the first:
     once the orb goes the card is there whole. */
  const first = React.useRef(false);
  const shown = view === "week" ? `w${iso(week[0])}` : `m${anchor.getFullYear()}-${anchor.getMonth()}`;
  React.useLayoutEffect(() => {
    const box = daysBox.current;
    if (step !== "pick" || !box || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!first.current) return void (first.current = true);
    const cells = [...box.querySelectorAll<HTMLElement>(".ed-day, .ed-cell, .ed-blank")];
    const at = (k: number) => (view === "week" ? k * 0.06 : (k % 7) * 0.03 + Math.floor(k / 7) * 0.06);
    let tw: gsap.core.Tween[] = [], gone = false;
    withGsap((gsap) => {
      if (gone) return;
      tw = cells.map((c, k) =>
        gsap.fromTo(c, { autoAlpha: 0, y: 10, rotationX: -35, transformPerspective: 500, transformOrigin: "50% 0%" }, { autoAlpha: 1, y: 0, rotationX: 0, duration: 0.45, delay: at(k), ease: "expo.out", clearProps: "opacity,visibility,transform" }),
      );
    });
    return () => {
      gone = true;
      tw.forEach((t) => t.progress(1).kill());
    };
  }, [step, shown, view, held, state]);
  /* The swipe nudge, on for everyone: on a touch
     screen the week eases 8px left and back after the cascade, no
     bounce, so the strip reads as
     something that swipes. Once a visit. */
  React.useEffect(() => {
    const row = daysBox.current?.firstElementChild as HTMLElement | null;
    if (step !== "pick" || view !== "week" || !row) return;
    if (!matchMedia("(pointer: coarse)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    try { if (sessionStorage.getItem("ed-nudged")) return; } catch {}
    const seen = () => { try { sessionStorage.setItem("ed-nudged", "1"); } catch {} };
    let tl: gsap.core.Timeline | undefined, gone = false;
    const play = () => withGsap((gsap) => { if (!gone) tl = gsap.timeline({ delay: 1.1, onStart: seen }).to(row, { x: -8, duration: 0.4, ease: "power2.out" }).to(row, { x: 0, duration: 0.5, ease: "power2.inOut" }); });
    /* Not behind the opening splash (MAC, real iOS): the delay starts once it has lifted. */
    const root = document.documentElement;
    const watch = new MutationObserver(() => { if (!root.hasAttribute("data-intro")) { watch.disconnect(); play(); } });
    if (root.hasAttribute("data-intro")) watch.observe(root, { attributes: true, attributeFilter: ["data-intro"] });
    else play();
    /* Undone without spending the visit's nudge: it only counts once it has really started. */
    return () => {
      watch.disconnect();
      gone = true;
      if (!tl) return;
      const begun = tl.progress() > 0;
      tl.kill();
      if (begun) withGsap((gsap) => gsap.set(row, { x: 0 }));
    };
  }, [step, view, held, state]);
  /* Julian: a swipe across the days goes to the next or last week or
     month, as the arrows do (both layouts). */
  const swipeProps: React.HTMLAttributes<HTMLDivElement> = {
    onPointerDown: (e) => {
      if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY, done: false, v: 0, t: e.timeStamp, lx: e.clientX };
    },
    /* The days follow the finger once it is clearly sideways, give at the start of the calendar,
       and a flick or a third of the row turns the week; less springs back. */
    onPointerMove: (e) => {
      const s = swipe.current, row = daysBox.current?.firstElementChild as HTMLElement | null;
      if (!s || !row) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (!s.drag) {
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        s.drag = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        withGsap((gsap) => gsap.killTweensOf(row));
      }
      const dt = e.timeStamp - s.t! || 16;
      s.v = (e.clientX - s.lx!) / dt; // px per ms
      s.t = e.timeStamp;
      s.lx = e.clientX;
      const w = row.offsetWidth;
      const x = atStart && dx > 0 ? (dx * w * 0.55) / (w + 0.55 * dx) : dx;
      withGsap((gsap) => gsap.set(row, { x }));
    },
    onPointerUp: (e) => {
      const s = swipe.current;
      if (!s) return;
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      const row = daysBox.current?.firstElementChild as HTMLElement | null;
      if (s.drag && row) {
        s.done = true;
        const w = row.offsetWidth;
        // Where the flick was going: Apple's projection (0.998), damped to 40%.
        const ahead = dx + (s.v ?? 0) * 499 * 0.4;
        const dir = ahead < -w / 3 ? 1 : ahead > w / 3 && !atStart ? -1 : 0;
        /* Motion plan item 2 (docs/decisions.md): under Reduce Motion the row
           followed the finger, and on release it snaps; a turned week fades in. */
        if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
          withGsap((gsap) => gsap.set(row, { clearProps: "transform" }));
          if (dir) {
            shift(dir);
            row.animate({ opacity: [0, 1] }, { duration: 150, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
          }
          return;
        }
        withGsap((gsap) => {
          if (!dir) return void gsap.to(row, { x: 0, duration: 0.5, ease: "expo.out" });
          gsap.to(row, {
            x: -dir * w,
            autoAlpha: 0,
            duration: 0.2,
            ease: "power2.in",
            onComplete: () => {
              shift(dir);
              gsap.set(row, { x: 0, autoAlpha: 1, clearProps: "transform,opacity,visibility" });
            },
          });
        });
        return;
      }
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return void (swipe.current = null);
      s.done = true;
      if (dx < 0) shift(1);
      else if (!atStart) shift(-1);
    },
    onPointerCancel: () => (swipe.current = null),
    // A swipe that ends on the day it began on is not a pick.
    onClickCapture: (e) => {
      if (swipe.current?.done) e.stopPropagation();
      swipe.current = null;
    },
  };

  return { stripEl, stripRef, more, setMore, root, v3root, was, showTimes, swipe, daysBox, monthGrid, big, slotsBox, slotsW, setSlotsW, slotsRO, slotsRef, at, refit, first, shown, swipeProps };
}
