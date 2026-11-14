import type { Driver } from "./engine";
import { QUOTE_CLIENTS } from "../data";

/* By quote client rotation (spec 3.5). Runs on the engine's frame, so it
   stops with the tab; it also waits while the section is off screen, a card is
   open or an option's photo is showing. The DOM is marked directly (`data-q`,
   `data-rot`, `data-sw`): React's `ci` stays 0 and never rewrites these. */
const EVERY = 5500;
const SWAP = 500; // the name fades out, swaps, fades in
const REST = 8000; // touch: back to the clients this long after the last tap

const s = { k: 0, t: 0, swap: 0, tap: -REST, rot: false, sets: [] as Element[][], names: [] as (Element | null)[], root: null as HTMLElement | null };
const show = (k: number) => s.sets.forEach((set) => set.forEach((c, i) => c.toggleAttribute("data-q", i === k)));
const write = (k: number) =>
  s.names.forEach((n) => {
    // keep React's own text node
    if (n?.firstChild) (n.firstChild as Text).data = QUOTE_CLIENTS[k].name;
    n?.removeAttribute("data-sw");
  });

export const quoteDrivers: Driver[] = [
  {
    name: "quote",
    always: true,
    setup(el) {
      s.sets = [".mt-photo", ".mt-photo-w"].map((f) => [...el.querySelectorAll(`${f} > .cl`)]);
      s.names = [el.querySelector(".mt-by .nm"), el.querySelector(".mt-clcap")];
      s.root = el.closest<HTMLElement>(".mt");
      s.k = s.t = s.swap = 0;
      s.tap = -REST;
      show(0);
      const tap = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") s.tap = performance.now();
      };
      const opts = el.querySelector<HTMLElement>(".mt-qos");
      opts?.addEventListener("pointerdown", tap);
      return () => {
        opts?.removeEventListener("pointerdown", tap);
        show(-1);
        write(0);
        el.removeAttribute("data-rot");
        el.dataset.client = "0";
        s.rot = false;
      };
    },
    frame(p, el, ctx) {
      if (s.swap > 0 && (s.swap -= ctx.dt) <= 0) write(s.k);
      const rot = ctx.fine ? !el.hasAttribute("data-opt") : ctx.t - s.tap > REST;
      if (rot !== s.rot) el.toggleAttribute("data-rot", (s.rot = rot));
      if (!rot || p <= 0 || p >= 1 || s.root?.dataset.cards === "open") return;
      if ((s.t += ctx.dt) < EVERY) return;
      s.t = 0;
      s.k = (s.k + 1) % QUOTE_CLIENTS.length;
      show(s.k);
      el.dataset.client = String(s.k);
      s.names.forEach((n) => n?.setAttribute("data-sw", ""));
      s.swap = SWAP;
    },
  },
];
