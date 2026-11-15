import { shiftScroll } from "@/components/v3/smooth-scroll";
import { captionsOff, vimeoListen, vimeoPlays } from "@/lib/videos";
import { clamp, smooth, type Driver } from "./engine";

/* The held row's travel: it eases away from its first item and into its last (0.4 of the scroll's speed at the two ends). */
const ease = (p: number) => p - (0.6 * Math.sin(2 * Math.PI * p)) / (2 * Math.PI);
/** the scroll share at which `ease` reaches v (it only rises, so halving finds it) */
const unease = (v: number) => {
  let a = 0, b = 1;
  for (let k = 0; k < 20; k++) if (ease((a + b) / 2) < v) a = (a + b) / 2; else b = (a + b) / 2;
  return (a + b) / 2;
};

/* Cover art (spec 3.7): on the desktop structure the page scroll walks the row
   sideways. Motion (spec 3.8): a vertical stack there, see films() below.
   Everywhere else the native snap rows stay. */

const RISE: KeyframeAnimationOptions = { duration: 600, easing: "cubic-bezier(.16,1,.3,1)" };

function heldRow(name: string, covers: boolean): Driver {
  let frame: (p: number) => void = () => {};
  return {
    name,
    frame: (p) => frame(p),
    setup(el, ctx) {
      const row = el.querySelector<HTMLElement>(".mt-row")!;
      const track = row.firstElementChild as HTMLElement;
      const items = [...track.children] as HTMLElement[];
      const n = items.length;
      if (n < 2) return;
      const ac = new AbortController();
      const on = { signal: ac.signal };
      const o: number[] = Array(n).fill(-1);
      let step = 1, c0 = 0, mid = 0, range = 0, cur = -1, base = 0, lastX = NaN;

      const measure = () => {
        // flow.css scales the row as it enters and settles: measure it at rest
        row.style.transform = "none";
        const a = items[0].getBoundingClientRect();
        step = items[1].getBoundingClientRect().left - a.left;
        c0 = row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).paddingLeft) + a.width / 2;
        mid = innerWidth / 2;
        range = el.offsetHeight - innerHeight;
        row.style.transform = "";
        cur = -1;
        lastX = NaN;
      };

      /* Record rule: out at the stage centre, back in the sleeve `fall` px away. */
      const discs = (x: number, fall: number) => {
        for (let i = 0; i < n; i++) {
          // eased: the record leaves and returns slowly at both ends instead of at one speed (Julian, 2026-11-14)
          const v = Math.round(smooth(clamp(1 - Math.abs(c0 + i * step - x - mid) / fall)) * 1000) / 1000;
          if (v !== o[i]) items[i].style.setProperty("--o", String((o[i] = v)));
        }
      };
      // Snap rows: the disc only exists on the current sleeve, which changes at half a step, so it is back in by then.
      const loose = () => {
        if (covers && !ctx.held) discs(row.scrollLeft, step / 2);
      };

      frame = (p) => {
        p = ease(p);
        const i = Math.round(p * (n - 1)), x = p * (n - 1) * step;
        if (i !== cur) {
          // The row's own scroll steps item by item so held-row.tsx names the current one; the transform carries the rest.
          row.scrollLeft = i * step;
          base = row.scrollLeft;
          cur = i;
        } else if (x === lastX) return;
        lastX = x;
        track.style.transform = `translate3d(${(base - x).toFixed(2)}px,0,0)`;
        if (covers) discs(x, 420 * ctx.u);
      };

      // The title line rises when held-row.tsx commits the new item.
      const mo = new MutationObserver(() => {
        if (ctx.held) el.querySelector(".mt-ttl .ln > span")?.animate([{ transform: "translateY(110%)" }, { transform: "none" }], RISE);
      });
      mo.observe(el, { attributeFilter: ["data-cur"] });

      /* Sideways drag moves the page scroll, so the two never disagree. */
      const top = () => el.getBoundingClientRect().top + scrollY;
      let down: number | null = null, downY = 0, dragged = false;
      row.addEventListener("pointerdown", (e) => {
        if (!ctx.held || e.button) return;
        down = e.clientX;
        downY = scrollY;
        dragged = false;
      }, on);
      row.addEventListener("pointermove", (e) => {
        if (down === null) return;
        if (!e.buttons) return void (down = null);
        const dx = e.clientX - down;
        if (!dragged && Math.abs(dx) < 6) return;
        if (!dragged) row.setPointerCapture(e.pointerId);
        dragged = true;
        // From the drag's start, not step by step: scrollY rounds and the error would add up.
        const t = top();
        shiftScroll(clamp(downY - (dx * range) / ((n - 1) * step), t, t + range) - scrollY);
      }, on);
      const up = () => void (down = null);
      row.addEventListener("pointerup", up, on);
      row.addEventListener("pointercancel", up, on);
      row.addEventListener("click", (e) => {
        if (!dragged) return;
        dragged = false;
        e.preventDefault();
        e.stopPropagation();
      }, { capture: true, signal: ac.signal });
      row.addEventListener("dragstart", (e) => { if (ctx.held) e.preventDefault(); }, on);

      // Tab to a film: the browser scrolls the hidden row to show it. Put that back and move the page there instead.
      row.addEventListener("focusin", (e) => {
        const t = e.target as Element, i = items.indexOf(t.closest<HTMLElement>(".mt-item")!);
        if (!ctx.held || i < 0 || !t.matches(":focus-visible")) return;
        row.scrollLeft = base;
        shiftScroll(top() + unease(i / (n - 1)) * range - scrollY);
      }, on);

      row.addEventListener("scroll", loose, { passive: true, signal: ac.signal });

      /* Hover lift (fine pointers): tilt toward the pointer, up to 9deg each way. rows.css does the rest. */
      if (covers) for (const it of items) {
        it.addEventListener("pointermove", (e) => {
          if (!ctx.held || !ctx.fine || e.pointerType === "touch" || dragged) return;
          const r = it.getBoundingClientRect();
          it.classList.add("hv");
          it.style.setProperty("--ry", (clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5) * 18).toFixed(2) + "deg");
          it.style.setProperty("--rx", (clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5) * -18).toFixed(2) + "deg");
        }, on);
        it.addEventListener("pointerleave", () => {
          it.classList.remove("hv");
          it.style.removeProperty("--rx");
          it.style.removeProperty("--ry");
        }, on);
      }

      // After the engine's own resize pass, so ctx is current.
      addEventListener("resize", () => requestAnimationFrame(() => {
        measure();
        if (ctx.held) return;
        track.style.transform = "";
        loose();
      }), on);

      measure();
      loose();
      return () => {
        ac.abort();
        mo.disconnect();
        frame = () => {};
        track.style.transform = "";
        for (const it of items) {
          it.classList.remove("hv");
          if (covers) it.style.setProperty("--o", "0.5");
        }
      };
    },
  };
}

/* Motion on the desktop structure: the films share one screen and rows.tsx
   picks the current one from the hold. Only the muted preview lives here. */
function films(): Driver {
  return {
    name: "motion",
    setup(el, ctx) {
      const row = el.querySelector<HTMLElement>(".mt-row")!;
      const items = [...el.querySelectorAll<HTMLElement>(".mt-film")];
      const n = items.length;
      if (n < 2) return;
      const ac = new AbortController();
      const on = { signal: ac.signal };
      let cur = +(el.dataset.cur ?? 0);
      /* Previews: a muted player in the current film, and one in the film before and after it, started and
         then paused so they are loaded when their turn comes (Julian, 2026-11-14). The poster stays on top
         until the player says it plays (same wait as video.tsx Loop). Players only ever start while the
         page rests, the current film's first, the others one at a time. */
      type Pv = { f: HTMLIFrameElement; yt: boolean; played: boolean; at: number; t: number; t1: number };
      const pool = new Map<number, Pv>();
      let pvT = 0, seen = false, movedAt = 0;
      addEventListener("scroll", () => (movedAt = performance.now()), { passive: true, signal: ac.signal });
      const say = (v: Pv, yt: string, vimeo: string) =>
        v.f.contentWindow?.postMessage(JSON.stringify(v.yt ? { event: "command", func: yt, args: [] } : { method: vimeo }), "*");
      const kill = (i: number) => {
        const v = pool.get(i);
        if (!v) return;
        clearTimeout(v.t);
        v.f.remove();
        pool.delete(i);
      };
      const drop = () => {
        clearTimeout(pvT);
        for (const i of [...pool.keys()]) kill(i);
      };
      const mount = (i: number) => {
        const film = items[i], src = film.dataset.preview!;
        const yt = src.includes("youtube");
        const f = document.createElement("iframe");
        const v: Pv = { f, yt, played: false, at: performance.now(), t: 0, t1: 0 };
        f.src = src + (yt ? "&enablejsapi=1" : "");
        f.allow = "autoplay";
        f.tabIndex = -1;
        f.setAttribute("aria-hidden", "true");
        f.onload = () => {
          if (!yt) return void vimeoListen(f.contentWindow);
          f.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1 }), "*");
          captionsOff(f.contentWindow);
        };
        film.append(f);
        pool.set(i, v);
      };
      // YouTube draws its own title and controls for about 2.5s after a first start: the poster covers that
      const show = (v: Pv) => {
        if (v.f.hasAttribute("data-ready") || v.t) return;
        v.t = window.setTimeout(() => ((v.t = 0), v.f.setAttribute("data-ready", "")), v.yt ? Math.max(350, 2500 - (performance.now() - v.t1)) : 0);
      };
      const wants = (i: number) => i >= 0 && i < n && !!items[i].dataset.preview && !pool.has(i);
      const fill = () => {
        // a player takes about 300ms of the graphics thread to start: never start one mid-scroll. "Resting" is 600ms
        // with no scroll at all (between two wheel notches the page is still for a moment).
        if (performance.now() - movedAt < 600) return void (pvT = window.setTimeout(fill, 200));
        const next = [cur, cur + 1, cur - 1].find(wants);
        if (next === undefined) return;
        // a neighbour waits until every player already here plays (or has had 6s: a blocked one never will)
        const busy = [...pool.values()].some((v) => !v.played && performance.now() - v.at < 6000);
        if (next !== cur && busy) return void (pvT = window.setTimeout(fill, 400));
        mount(next);
        pvT = window.setTimeout(fill, 400);
      };
      const preview = () => {
        clearTimeout(pvT);
        if (!seen || !ctx.held) return drop();
        for (const [i, v] of [...pool]) {
          if (Math.abs(i - cur) > 1) kill(i);
          else if (i !== cur) {
            clearTimeout(v.t);
            v.t = 0;
            v.f.removeAttribute("data-ready");
            // a waiting YouTube film keeps playing, muted and unseen: paused, it draws its control bar over the film
            // when it resumes (JG - MAC, Safari, 2026-11-15). Vimeo's background player has no controls, so it rests.
            if (v.played && !v.yt) say(v, "pauseVideo", "pause");
          } else if (v.played) {
            if (v.yt) show(v);
            else say(v, "playVideo", "play");
          }
        }
        pvT = window.setTimeout(fill, 300);
      };
      addEventListener("message", (e) => {
        const hit = [...pool].find(([, v]) => v.f.contentWindow === e.source);
        if (!hit) return;
        const [i, v] = hit;
        let m;
        try { m = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
        // Vimeo: the poster lifts only when the player says frames are moving
        if (m?.event === "ready") return void vimeoListen(v.f.contentWindow);
        const state = m?.event === "onStateChange" ? m.info : m?.event === "infoDelivery" ? m.info?.playerState : undefined;
        const plays = vimeoPlays(m) || state === 1;
        if (!plays && typeof state !== "number") return;
        if (plays) {
          if (!v.played) v.t1 = performance.now();
          v.played = true;
          if (state === 1) captionsOff(v.f.contentWindow);
          if (i !== cur) return void (v.yt || say(v, "pauseVideo", "pause"));
          show(v);
        } else if (i === cur && state !== 2) {
          clearTimeout(v.t);
          v.t = 0;
          v.f.removeAttribute("data-ready");
        }
      }, on);
      const io = new IntersectionObserver(([e]) => {
        seen = e.isIntersecting;
        preview();
      });
      io.observe(el);

      // rows.tsx names the current film; its preview follows and the title line rises.
      const mo = new MutationObserver(() => {
        cur = +(el.dataset.cur ?? 0);
        preview();
        if (ctx.held) el.querySelector(".mt-ttl .ln > span")?.animate([{ transform: "translateY(110%)" }, { transform: "none" }], RISE);
      });
      mo.observe(el, { attributeFilter: ["data-cur"] });

      // The row does not scroll here, so it is not a tab stop of its own.
      const tab = () => void (row.tabIndex = ctx.held ? -1 : 0);
      addEventListener("resize", () => requestAnimationFrame(() => {
        tab();
        if (!ctx.held) drop();
      }), on);
      tab();
      return () => {
        ac.abort();
        mo.disconnect();
        io.disconnect();
        drop();
        row.tabIndex = 0;
      };
    },
  };
}

export const rowsDrivers: Driver[] = [heldRow("covers", true), films()];
