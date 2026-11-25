import type { Driver, HomeSection } from "./engine";

/* Phones and tablets: Book online gets the bottom bar while
   it fills the screen. Its rows change only when one is tapped,
   never with the scroll. */
const bar = (name: HomeSection): Driver => ({
  name,
  always: true,
  setup(el) {
    let on = false;
    return {
      frame: (_p, el, ctx) => {
        if (ctx.held) return;
        // the bottom bar belongs to the section that fills the screen, so two bars never stack
        if (ctx.top < ctx.vh * 0.45 !== on) el.toggleAttribute("data-bar", (on = !on));
      },
      off: () => el.removeAttribute("data-bar"),
    };
  },
});

export const barDrivers: Driver[] = [bar("book")];
