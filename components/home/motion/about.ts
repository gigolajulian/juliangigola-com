import { progressBetween, type Driver, type Frame } from "./engine";

/* About (spec 3.9). The desktop beats are pure CSS on a timer (about.css, `data-seen`). Without a hold the sentence and the rows light as they scroll
   through the screen: this writes their progress as --sp and --rp. */

export const aboutDrivers: Driver[] = [
  {
    name: "about",
    always: true,
    setup(el) {
      const m = { say: 0, ol: 0, ft: 0, sp: "", rp: "", ep: "" };
      const frame: Frame = (_p, el, ctx) => {
        if (ctx.held) return;
        const top = ctx.top;
        const sp = progressBetween(top + m.say, 0.8 * ctx.vh, 0.35 * ctx.vh).toFixed(3);
        const rp = progressBetween(top + m.ol, 0.72 * ctx.vh, 0.48 * ctx.vh).toFixed(3);
        if (sp !== m.sp) el.style.setProperty("--sp", (m.sp = sp));
        if (rp !== m.rp) el.style.setProperty("--rp", (m.rp = rp));
        // the facts and the button come up as the foot of the column reaches the lower part of the screen
        const ep = progressBetween(top + m.ft, 0.92 * ctx.vh, 0.55 * ctx.vh).toFixed(3);
        if (ep !== m.ep) el.style.setProperty("--ep", (m.ep = ep));
      };
      const say = el.querySelector<HTMLElement>(".mt-say");
      const ol = el.querySelector<HTMLElement>(".mt-does ol");
      if (!say || !ol) return { frame };
      // offsets inside the section, so the frame path reads no layout
      const measure = () => {
        const r = el.getBoundingClientRect();
        m.say = say.getBoundingClientRect().top - r.top;
        m.ol = ol.getBoundingClientRect().top - r.top;
        m.ft = (el.querySelector(".mt-ab-foot") ?? ol).getBoundingClientRect().top - r.top;
      };
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      measure();
      // desktop: the timed reveal starts once a third of the section is on screen, and plays once
      const io = new IntersectionObserver(([e]) => e.isIntersecting && el.setAttribute("data-seen", ""), { threshold: 0.35 });
      io.observe(el);
      return {
        frame,
        off: () => {
          ro.disconnect();
          io.disconnect();
          el.removeAttribute("data-seen");
          el.style.removeProperty("--sp");
          el.style.removeProperty("--rp");
          el.style.removeProperty("--ep");
        },
      };
    },
  },
];
