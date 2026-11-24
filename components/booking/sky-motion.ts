import * as React from "react";
import type { gsap as G } from "gsap";
import type { Flip as F } from "gsap/Flip";
import { loadGsap } from "@/lib/motion/gsap-lazy";

/* The sky picker's motion (?sky): Week and Month morph into each other
   (GSAP Flip, the days keep their boxes and travel to their new place), the
   arrows slide the next week or month in from their side, and a day's times
   come up one after another. Off under reduced motion; before gsap and Flip
   have loaded, the change just happens. */
let gsap: typeof G | undefined;
let flip: typeof F | undefined;
const warm = () =>
  void Promise.all([loadGsap(), import("gsap/Flip")]).then(([g, m]) => {
    g.registerPlugin(m.Flip);
    gsap = g;
    flip = m.Flip;
  });
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** For the calendar: call `before(dir)` right before a view switch (dir 0) or an arrow (dir ±1). */
export function useSkyCalendar(on: boolean, cal: React.RefObject<HTMLDivElement | null>) {
  const pending = React.useRef<{ state: Flip.FlipState | null; dir: number } | null>(null);
  React.useEffect(() => {
    if (on) warm();
  }, [on]);
  const parts = () => {
    const body = cal.current?.closest(".f-body") ?? cal.current?.parentElement;
    // the days and the picker's blocks around them; never a block that holds another target
    return [...(cal.current?.children ?? []), ...(body?.querySelectorAll(".cal-top, .sky-ruler, .sky-rows, .fig.scrub") ?? [])] as HTMLElement[];
  };
  const before = (dir: number) => {
    if (!on || !flip || calm()) return;
    pending.current = { state: dir ? null : flip.getState(parts()), dir };
  };
  React.useLayoutEffect(() => {
    const p = pending.current;
    const el = cal.current;
    if (!p || !el || !gsap || !flip) return;
    pending.current = null;
    const days = [...el.querySelectorAll<HTMLElement>("button[data-day]")];
    if (p.dir) {
      // the next week or month slides in from the side the arrow points to
      const op = days.map((t) => Number(getComputedStyle(t).opacity));
      gsap.fromTo(days, { autoAlpha: 0, x: 28 * p.dir }, { autoAlpha: (i: number) => op[i], x: 0, duration: 0.5, ease: "expo.out", stagger: { each: 0.012, from: p.dir > 0 ? "start" : "end" }, clearProps: "opacity,visibility,transform" });
      return;
    }
    // New days grow out from the picked one's row, nearest first.
    const at = el.querySelector<HTMLElement>('[aria-pressed="true"]');
    const ref = at?.getBoundingClientRect();
    const near = (t: Element) => {
      if (!ref) return 0;
      const r = t.getBoundingClientRect();
      return Math.abs(r.top - ref.top) / ref.height + Math.abs(r.left - ref.left) / ref.width / 3;
    };
    const g = gsap;
    flip.from(p.state!, {
      targets: parts(),
      // out, not inOut: the days answer the tap on the next frame and are mostly home before the new ones show
      duration: 0.5,
      ease: "expo.out",
      nested: true,
      onEnter: (els) => {
        // to each day's own opacity: a closed day sits at .45, and fading it to 1 first flashed it
        const op = els.map((t) => Number(getComputedStyle(t).opacity));
        return g.fromTo(els, { autoAlpha: 0, scale: 0.92, y: 8 }, { autoAlpha: (i: number) => op[i], scale: 1, y: 0, duration: 0.45, ease: "expo.out", stagger: (_i: number, t: Element) => near(t) * 0.035, clearProps: "opacity,visibility,transform" });
      },
    });
  });
  return before;
}

/** For the times: they come up one after another when the day changes. */
export function useSkyTimesIn(box: React.RefObject<HTMLDivElement | null>, day: string) {
  const first = React.useRef(true);
  React.useEffect(() => {
    warm();
  }, []);
  React.useLayoutEffect(() => {
    if (first.current) return void (first.current = false);
    const el = box.current;
    if (!el || !gsap || calm()) return;
    gsap.fromTo(el.querySelectorAll("[data-slot], .rl, .grp"), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "expo.out", stagger: 0.025, clearProps: "opacity,visibility,transform" });
  }, [day, box]);
}
