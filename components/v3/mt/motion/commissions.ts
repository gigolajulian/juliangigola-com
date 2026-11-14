import { clamp, type Driver } from "./engine";

/* Commissions (spec 3.3): the held head names the frame under the screen's
   centre, and the client logos drift as one endless line that scroll pushes. */
const IDLE = 0.028; // px/ms
const GAIN = 0.0012; // px/ms of push per px scrolled in a frame
const MAX = 0.6; // px/ms, so a hard flick does not blur the marks
const MAX_PHONE = 0.35;
const RISE: KeyframeAnimationOptions = { duration: 600, easing: "cubic-bezier(.16,1,.3,1)" };

const s = { track: null as HTMLElement | null, w: 0, seen: false, x: 0, v: IDLE, kick: 0 };
const put = (n: Element | null, text: string) => {
  // keep React's own text node
  if (n?.firstChild) (n.firstChild as Text).data = text;
};

export const commissionsDrivers: Driver[] = [
  {
    name: "comm",
    always: true,
    setup(el) {
      const count = el.querySelector("[data-mt-count]");
      const name = el.querySelector(".mt-cur [data-mt-name]");
      const meta = el.querySelector(".mt-cur .mute");
      const first = [count, name, meta].map((n) => n?.textContent ?? "");
      // a point at the screen's centre, 1% left of it so it never sits on the sheet's middle seam
      const cur = new IntersectionObserver(
        (es) => {
          const f = es.find((e) => e.isIntersecting)?.target as HTMLElement | undefined;
          if (!f || f.dataset.i === el.dataset.cur) return;
          el.dataset.cur = f.dataset.i;
          put(count, String(Number(f.dataset.i) + 1).padStart(2, "0"));
          put(name, f.querySelector(".nm")?.textContent ?? "");
          put(meta, f.querySelector("figcaption .mute")?.textContent ?? "");
          for (const n of [count, name, meta]) n?.animate([{ transform: "translateY(110%)" }, { transform: "none" }], RISE);
        },
        { rootMargin: "-50% -51% -50% -49%" },
      );
      el.querySelectorAll(".mt-sheet figure").forEach((f) => cur.observe(f));

      const strip = el.querySelector<HTMLElement>(".mt-logos");
      const row = el.querySelector<HTMLElement>(".mt-logos-row");
      const track = (s.track = el.querySelector<HTMLElement>(".mt-logos-track"));
      const set = track?.querySelector<HTMLElement>(".set");
      const copy = track?.querySelector<HTMLElement>("[data-copy]");
      if (!strip || !row || !track || !set || !copy) return () => cur.disconnect();
      const extra: Element[] = [];
      const measure = () => {
        s.w = set.offsetWidth;
        if (!s.w) return;
        // a row wider than one set needs more copies to stay full
        for (let n = Math.ceil(row.clientWidth / s.w) + 1; track.children.length < n; ) {
          extra.push(track.appendChild(copy.cloneNode(true)) as Element);
        }
      };
      const ro = new ResizeObserver(measure);
      ro.observe(row);
      ro.observe(set);
      const see = new IntersectionObserver(([e]) => (s.seen = e.isIntersecting));
      see.observe(strip);
      return () => {
        cur.disconnect();
        ro.disconnect();
        see.disconnect();
        extra.forEach((n) => n.remove());
        track.style.transform = "";
        el.dataset.cur = "0";
        [count, name, meta].forEach((n, i) => put(n, first[i]));
        s.track = null;
      };
    },
    frame(_p, _el, ctx) {
      if (!s.seen || !s.w || !s.track) return;
      const max = ctx.held ? MAX : MAX_PHONE;
      s.kick = clamp(s.kick * 0.94 ** (ctx.dt / 16.7) + ctx.dy * GAIN, -max, max);
      s.v += (IDLE + s.kick - s.v) * (1 - Math.exp(-ctx.dt / 180));
      s.x = (((s.x + s.v * ctx.dt) % s.w) + s.w) % s.w;
      s.track.style.transform = `translate3d(${-s.x}px,0,0)`;
    },
  },
];
