import { clamp, rise, tell, type Ctx, type Driver } from "./engine";

/* Commissions (spec 3.3): the held head names the frame under the screen's
   centre, and the client logos drift as one endless line that scroll pushes. */
const IDLE = 0.028; // px/ms
const GAIN = 0.0012; // px/ms of push per px scrolled in a frame
const MAX = 0.6; // px/ms, so a hard flick does not blur the marks
const MAX_PHONE = 0.35;

// the logo line's offset, speed and push outlive a cleanup: a remount carries on where the line was
const drift = { x: 0, v: IDLE, kick: 0 };

export const commissionsDrivers: Driver[] = [
  {
    name: "comm",
    always: true,
    setup(el) {
      const s = { o: 1, w: 0, seen: false, hover: false, focus: false };
      const head = el.querySelector<HTMLElement>(".mt-comm-head");
      const logos = el.querySelector<HTMLElement>(".mt-logos");
      const fade = (ctx: Ctx) => {
        if (head && logos && (ctx.dy || ctx.fresh)) {
          // gone while the logos are still 40% of a screen below it
          // on or off, not a scroll-tied fade: commissions.css times the fade
          const o = !ctx.held || logos.getBoundingClientRect().top - head.getBoundingClientRect().bottom > ctx.vh * 0.5 ? 1 : 0;
          if (o !== s.o) head.toggleAttribute("data-out", !(s.o = o));
        }
      };
      const count = el.querySelector("[data-mt-count]");
      const name = el.querySelector(".mt-cur [data-mt-name]");
      const meta = el.querySelector(".mt-cur .mute");
      // a point at the screen's centre, 1% left of it so it never sits on the sheet's middle seam
      const cur = new IntersectionObserver(
        (es) => {
          const f = es.find((e) => e.isIntersecting)?.target as HTMLElement | undefined;
          if (!f || f.dataset.i === el.dataset.cur) return;
          tell(el, { cur: Number(f.dataset.i) }); // commissions.tsx renders data-cur and the three lines
          for (const n of [count, name, meta]) rise(n);
        },
        { rootMargin: "-50% -51% -50% -49%" },
      );
      el.querySelectorAll(".mt-sheet figure").forEach((f) => cur.observe(f));

      const strip = el.querySelector<HTMLElement>(".mt-logos");
      const row = el.querySelector<HTMLElement>(".mt-logos-row");
      const track = el.querySelector<HTMLElement>(".mt-logos-track");
      const set = track?.querySelector<HTMLElement>(".set");
      const copy = track?.querySelector<HTMLElement>("[data-copy]");
      if (!strip || !row || !track || !set || !copy) return { frame: (_p, _el, ctx) => fade(ctx), off: () => cur.disconnect() };
      const extra: Element[] = [];
      const measure = () => {
        s.w = set.offsetWidth;
        if (!s.w) return;
        // a row wider than one set needs more copies to stay full
        for (let n = Math.ceil(row.clientWidth / s.w) + 1; track.children.length < n;) {
          extra.push(track.appendChild(copy.cloneNode(true)) as Element);
        }
      };
      const ro = new ResizeObserver(measure);
      ro.observe(row);
      ro.observe(set);
      const see = new IntersectionObserver(([e]) => (s.seen = e.isIntersecting));
      see.observe(strip);
      const ac = new AbortController();
      const on = (type: string, f: (e: Event) => void) => row.addEventListener(type, f, { signal: ac.signal });
      on("pointerenter", () => (s.hover = true));
      on("pointerleave", () => (s.hover = false));
      // keyboard focus only: a click focuses the row too, and that focus outlives the pointer
      on("focusin", (e) => (s.focus = (e.target as Element).matches(":focus-visible")));
      on("focusout", () => (s.focus = false));
      return {
        frame: (_p, _el, ctx) => {
          fade(ctx);
          if (!s.seen || !s.w) return;
          const max = ctx.held ? MAX : MAX_PHONE;
          drift.kick = clamp(drift.kick * 0.94 ** (ctx.dt / 16.7) + ctx.dy * GAIN, -max, max);
          drift.v += ((s.hover || s.focus ? 0 : IDLE) + drift.kick - drift.v) * (1 - Math.exp(-ctx.dt / 180));
          drift.x = (((drift.x + drift.v * ctx.dt) % s.w) + s.w) % s.w;
          track.style.transform = `translate3d(${-drift.x}px,0,0)`;
        },
        off: () => {
          cur.disconnect();
          ro.disconnect();
          see.disconnect();
          ac.abort();
          extra.forEach((n) => n.remove());
          track.style.transform = "";
          tell(el, { cur: 0 }, false);
          head?.removeAttribute("data-out");
        },
      };
    },
  },
];
