import type { Driver } from "./engine";

/* Phones and tablets: Book online and By quote each get the bottom bar while
   they fill the screen. Their rows change only when one is tapped: the scroll
   walk through the rows is gone (Julian, 2026-11-14). */
const bar = (name: string): Driver => {
  let on = false;
  return {
    name,
    always: true,
    setup(el) {
      return () => {
        el.removeAttribute("data-bar");
        on = false;
      };
    },
    frame(_p, el, ctx) {
      if (ctx.held) return;
      // the bottom bar belongs to the section that fills the screen, so two bars never stack
      if (ctx.top < ctx.vh * 0.45 !== on) el.toggleAttribute("data-bar", (on = !on));
    },
  };
};

export const stepDrivers: Driver[] = [bar("book"), bar("quote")];
