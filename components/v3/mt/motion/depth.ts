import type { Driver } from "./engine";

/* Pointer depth (spec 3.12): one mouse listener, one rAF that eases --px / --py
   toward the pointer and stops when it gets there. The visuals are in depth.css.
   The vars go on the consumers, not on .v3home: a custom property on the root
   would restyle the whole page every frame. */
export const depthDrivers: Driver[] = [
  {
    name: "hero",
    setup(el, ctx) {
      const hero = [el.querySelector<HTMLElement>(".mt-wall"), el.querySelector<HTMLElement>(".mt-name")];
      const sheet = el.closest(".mt")?.querySelector<HTMLElement>(".mt-sheet") ?? null;
      let heroH = el.offsetHeight;
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
      const draw = () => {
        cx += (tx - cx) * 0.1;
        cy += (ty - cy) * 0.1;
        // only the consumer on screen: the hero while it holds, the sheet after
        for (const t of ctx.y < heroH ? hero : [sheet]) {
          t?.style.setProperty("--px", cx.toFixed(4));
          t?.style.setProperty("--py", cy.toFixed(4));
        }
        raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002 ? requestAnimationFrame(draw) : 0;
      };
      const move = (e: PointerEvent) => {
        if (e.pointerType !== "mouse" || !ctx.held) return;
        tx = (e.clientX / ctx.vw) * 2 - 1;
        ty = (e.clientY / ctx.vh) * 2 - 1;
        raf ||= requestAnimationFrame(draw);
      };
      // the pointer left the window: settle flat
      const leave = () => {
        tx = ty = 0;
        raf ||= requestAnimationFrame(draw);
      };
      const size = () => (heroH = el.offsetHeight);
      addEventListener("pointermove", move, { passive: true });
      document.documentElement.addEventListener("mouseleave", leave);
      addEventListener("resize", size);
      return () => {
        cancelAnimationFrame(raf);
        removeEventListener("pointermove", move);
        document.documentElement.removeEventListener("mouseleave", leave);
        removeEventListener("resize", size);
        for (const t of [...hero, sheet]) {
          t?.style.removeProperty("--px");
          t?.style.removeProperty("--py");
        }
      };
    },
  },
];
