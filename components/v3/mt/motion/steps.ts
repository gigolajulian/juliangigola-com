import { clamp, type Driver } from "./engine";

/* Phones and tablets: as Book online and By quote come up the screen, the
   scroll walks through their rows one by one. Nothing is pinned and no scroll
   length is added. The section listens for `mt-step` and makes that row the
   current one; a tap wins for a few seconds. */
const HOLD_AFTER_TAP = 4000;

const stepper = (name: string, count: number): Driver => {
  let last = -1;
  let tap = -HOLD_AFTER_TAP;
  let bar = false;
  return {
    name,
    always: true,
    setup(el) {
      const down = () => (tap = performance.now());
      el.addEventListener("pointerdown", down);
      return () => {
        el.removeEventListener("pointerdown", down);
        el.removeAttribute("data-bar");
        bar = false;
        last = -1;
      };
    },
    frame(_p, el, ctx) {
      if (ctx.held) return void (last = -1);
      // the bottom bar belongs to the section that fills the screen, so two bars never stack
      const top = el.getBoundingClientRect().top;
      if (top < ctx.vh * 0.45 !== bar) el.toggleAttribute("data-bar", (bar = !bar));
      if (ctx.t - tap < HOLD_AFTER_TAP || el.closest<HTMLElement>(".mt")?.dataset.cards === "open") return;
      // the walk runs while the rows themselves are on screen: from the section's top a quarter down the screen to a third above it
      const from = ctx.vh * 0.25;
      const t = clamp((from - top) / (ctx.vh * 0.61));
      const i = Math.min(count - 1, Math.floor(t * count));
      if (i === last) return;
      last = i;
      el.dispatchEvent(new CustomEvent("mt-step", { detail: i }));
    },
  };
};

export const stepDrivers: Driver[] = [stepper("book", 5), stepper("quote", 4)];
