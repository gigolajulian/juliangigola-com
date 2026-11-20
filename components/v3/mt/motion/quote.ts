import { put, type Driver } from "./engine";
import { QUOTE_CLIENTS } from "../data";

/* By quote client rotation (spec 3.5). Runs on the engine's frame, so it
   stops with the tab; it also waits while the section is off screen, a card is
   open, an option's photo is showing or keyboard focus (not a click's) is inside the section. The DOM is marked directly (`data-q`,
   `data-rot`, `data-sw`): React's `ci` stays 0 and never rewrites these. */
const EVERY = 5500;
const SWAP = 500; // the name fades out, swaps, fades in
const REST = 8000; // touch: back to the clients this long after the last tap

export const quoteDrivers: Driver[] = [
  {
    name: "quote",
    always: true,
    setup(el) {
      // ?mtask=1, a trial (Julian, 2026-11-17): the section as a full screen with the client photo behind the question (quote.css)
      document.documentElement.toggleAttribute("data-mtask", /[?&]mtask=1/.test(location.search));
      const s = { k: 0, t: 0, swap: 0, tap: -REST, rot: false };
      const sets = [".mt-photo", ".mt-photo-w"].map((f) => [...el.querySelectorAll(`${f} > .cl`)]);
      const names = [el.querySelector(".mt-by .nm"), el.querySelector(".mt-clcap")];
      const root = el.closest<HTMLElement>(".mt");
      const show = (k: number) => sets.forEach((set) => set.forEach((c, i) => c.toggleAttribute("data-q", i === k)));
      const write = (k: number) =>
        names.forEach((n) => {
          put(n, QUOTE_CLIENTS[k].name);
          n?.removeAttribute("data-sw");
        });
      show(0);
      const tap = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") s.tap = performance.now();
      };
      const opts = el.querySelector<HTMLElement>(".mt-qos");
      opts?.addEventListener("pointerdown", tap);
      return {
        frame: (p, el, ctx) => {
          if (s.swap > 0 && (s.swap -= ctx.dt) <= 0) write(s.k);
          const rot = ctx.fine ? !el.hasAttribute("data-opt") : ctx.t - s.tap > REST;
          if (rot !== s.rot) el.toggleAttribute("data-rot", (s.rot = rot));
          const a = document.activeElement;
          if (!rot || (!ctx.held && (p <= 0 || p >= 1)) || root?.dataset.cards === "open" || (a && el.contains(a) && a.matches(":focus-visible"))) return;
          if ((s.t += ctx.dt) < EVERY) return;
          s.t = 0;
          s.k = (s.k + 1) % QUOTE_CLIENTS.length;
          show(s.k);
          el.dataset.client = String(s.k);
          names.forEach((n) => n?.setAttribute("data-sw", ""));
          s.swap = SWAP;
        },
        off: () => {
          opts?.removeEventListener("pointerdown", tap);
          show(-1);
          write(0);
          el.removeAttribute("data-rot");
          el.dataset.client = "0";
        },
      };
    },
  },
];
