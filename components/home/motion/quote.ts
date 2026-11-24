import { tell, type Driver } from "./engine";
import { QUOTE_CLIENTS } from "@/lib/home/data";

/* By quote client rotation (spec 3.5). Runs on the engine's frame, so it
   stops with the tab; it also waits while the section is off screen, a card is
   open, an option's photo is showing or keyboard focus (not a click's) is inside the section. It tells by-quote.tsx
   which client to show (`k`: the photo, `data-q`, `data-client`) and, after the name's fade, which name (`name`, `data-sw`). */
const EVERY = 5500;
const SWAP = 500; // the name fades out, swaps, fades in
const REST = 8000; // touch: back to the clients this long after the last tap

export const quoteDrivers: Driver[] = [
  {
    name: "quote",
    always: true,
    setup(el) {
      const s = { k: 0, t: 0, swap: 0, tap: -REST, rot: false };
      const root = el.closest<HTMLElement>(".mt");
      const tap = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") s.tap = performance.now();
      };
      const opts = el.querySelector<HTMLElement>(".mt-qos");
      opts?.addEventListener("pointerdown", tap);
      return {
        frame: (p, el, ctx) => {
          if (s.swap > 0 && (s.swap -= ctx.dt) <= 0) tell(el, { name: s.k, sw: false });
          const rot = ctx.fine ? !el.hasAttribute("data-opt") : ctx.t - s.tap > REST;
          if (rot !== s.rot) el.toggleAttribute("data-rot", (s.rot = rot));
          const a = document.activeElement;
          if (!rot || (!ctx.held && (p <= 0 || p >= 1)) || root?.dataset.cards === "open" || (a && el.contains(a) && a.matches(":focus-visible"))) return;
          if ((s.t += ctx.dt) < EVERY) return;
          s.t = 0;
          s.k = (s.k + 1) % QUOTE_CLIENTS.length;
          tell(el, { k: s.k, sw: true });
          s.swap = SWAP;
        },
        off: () => {
          opts?.removeEventListener("pointerdown", tap);
          el.removeAttribute("data-rot");
          tell(el, { k: 0, name: 0, sw: false }, false);
        },
      };
    },
  },
];
