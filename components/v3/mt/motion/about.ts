import { span, type Driver } from "./engine";

/* About (spec 3.9). The held desktop beats are pure CSS on the engine's --p
   (about.css). Without a hold the sentence and the rows light as they scroll
   through the screen: this writes their progress as --sp and --rp. */
const m = { say: 0, ol: 0, h: 1, sp: "", rp: "" };

export const aboutDrivers: Driver[] = [
  {
    name: "about",
    always: true,
    setup(el) {
      const say = el.querySelector<HTMLElement>(".mt-say");
      const ol = el.querySelector<HTMLElement>(".mt-does ol");
      if (!say || !ol) return;
      // offsets inside the section, so the frame path reads no layout
      const measure = () => {
        const r = el.getBoundingClientRect();
        m.h = r.height;
        m.say = say.getBoundingClientRect().top - r.top;
        m.ol = ol.getBoundingClientRect().top - r.top;
      };
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      measure();
      return () => {
        ro.disconnect();
        el.style.removeProperty("--sp");
        el.style.removeProperty("--rp");
        m.sp = m.rp = "";
      };
    },
    frame(p, el, ctx) {
      if (ctx.held) return;
      // the engine's un-held p, turned back into the section's top edge
      const top = ctx.vh - p * (m.h + ctx.vh);
      const sp = span(top + m.say, 0.8 * ctx.vh, 0.35 * ctx.vh).toFixed(3);
      const rp = span(top + m.ol, 0.72 * ctx.vh, 0.48 * ctx.vh).toFixed(3);
      if (sp !== m.sp) el.style.setProperty("--sp", (m.sp = sp));
      if (rp !== m.rp) el.style.setProperty("--rp", (m.rp = rp));
    },
  },
];
