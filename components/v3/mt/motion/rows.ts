import { scrollGoal, settleTo, shiftScroll } from "@/components/v3/smooth-scroll";
import { holdEase as ease, holdUnease as unease } from "@/lib/motion/hold-ease";
import { captionsOff, vimeoListen, vimeoPlays } from "@/lib/videos";
import { RISE, clamp, smooth, type Ctx, type Driver } from "./engine";
import { sleeveTilt } from "./sleeve-tilt";


/* Julian, 2026-11-18 (?mtsnap=0 turns it off): a hold never rests between two items. When the scroll stops inside the hold, the page glides to the
   nearest one. Within a step of the item it rested on it leans 0.44 of a step the way the scroll went, so one wheel notch (100px, a small part of a step) moves on instead of
   falling back; ?mtsnap=near is plain nearest. `at`: the hold's share as an item position; `share`: an item's resting share of the hold. */
function snap(el: HTMLElement, ctx: Ctx, n: number, at: (p: number) => number, share: (i: number) => number, busy: () => boolean, signal: AbortSignal) {
  const m = /[?&]mtsnap=(\w+)/.exec(location.search)?.[1];
  if (m === "0" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const lean = m === "near" ? 0 : 0.44;
  let t = 0, rest = NaN; // the item position the page last settled on; NaN outside the hold, so arriving is plain nearest
  const settle = () => {
    // fine pointers only: a finger's own momentum is left alone (MAC, #1209: the iPad snapped too)
    if (!ctx.held || !ctx.fine || busy()) return;
    const top = el.getBoundingClientRect().top + scrollY, range = el.offsetHeight - innerHeight, y = scrollGoal(), p = (y - top) / range;
    // the two ends are items too: resting exactly there keeps `rest`, a pixel past them the page is free
    if (y < top - 1 || y > top + range + 1) return void (rest = NaN);
    const f = at(p), i = clamp(Math.round(f + (Math.abs(f - rest) < 1 ? Math.sign(f - rest) * lean : 0)), 0, n - 1), to = top + share(i) * range;
    rest = i;
    // 1px: scrollY is fractional, an exact compare would glide forever
    if (Math.abs(to - y) > 1) settleTo(to);
  };
  const on = () => {
    clearTimeout(t);
    t = window.setTimeout(settle, 140);
  };
  // wheel: the glide starts when the hand stops, not when Lenis's long tail does. scroll: keys, the scrollbar, touch.
  addEventListener("wheel", on, { passive: true, signal });
  addEventListener("scroll", on, { passive: true, signal });
  signal.addEventListener("abort", () => clearTimeout(t));
}

/* Cover art (spec 3.7): on the desktop structure the page scroll walks the row
   sideways. Motion (spec 3.8): a vertical stack there, see films() below.
   Everywhere else the native snap rows stay. */

function heldRow(name: string): Driver {
  let frame: (p: number) => void = () => {};
  return {
    name,
    frame: (p) => frame(p),
    setup(el, ctx) {
      const row = el.querySelector<HTMLElement>(".mt-row");
      if (!row) return;
      const track = row.firstElementChild as HTMLElement;
      const items = [...track.children] as HTMLElement[];
      const n = items.length;
      if (n < 2) return;
      const ac = new AbortController();
      const opts = { signal: ac.signal };
      const o: number[] = Array(n).fill(-1);
      let step = 1, c0 = 0, mid = 0, range = 0, cur = -1, base = 0, lastX = NaN;

      /* The V4 default since 2026-11-15 (Julian: "turn on the parallax by default"), ?mtpar=0 turns it off: the heading and the row ride up at their own
         rates and the stage hands over to Motion (rows.css). The pile the covers were dealt from is gone (Julian, 2026-11-17). */
      const par = !/[?&]mtpar=0/.test(location.search);
      if (par) document.documentElement.setAttribute("data-mt-par", "");
      // kept (Julian, 2026-11-17: "keep the lid"), ?mtlid=0 turns it off: Cover art waits under Commissions, which lifts off it like a lid (rows.css)
      if (par) document.documentElement.toggleAttribute("data-mt-lid", !/[?&]mtlid=0/.test(location.search));
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
      const discs = (x: number, fall: number, k = 1) => {
        for (let i = 0; i < n; i++) {
          // eased: the record leaves and returns slowly at both ends instead of at one speed (Julian, 2026-11-14)
          const v = Math.round(smooth(clamp(1 - Math.abs(c0 + i * step - x - mid) / fall)) * k * 1000) / 1000;
          if (v !== o[i]) items[i].style.setProperty("--o", String((o[i] = v)));
        }
      };
      // Snap rows: the disc only exists on the current sleeve, which changes at half a step, so it is back in by then.
      const loose = () => {
        if (!ctx.held) discs(row.scrollLeft, step / 2);
      };

      frame = (p) => {
        // the first record starts inside its sleeve and comes out over the first 5% of the hold (Julian, 2026-11-15)
        const k = smooth(clamp(p / 0.05));
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
        // 420 of the 520 design px between covers; by the measured step, so it holds where the covers stand closer (tall windows)
        discs(x, step * (420 / 520), k);
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
      }, opts);
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
      }, opts);
      const up = () => void (down = null);
      row.addEventListener("pointerup", up, opts);
      row.addEventListener("pointercancel", up, opts);
      row.addEventListener("click", (e) => {
        if (!dragged) return;
        dragged = false;
        e.preventDefault();
        e.stopPropagation();
      }, { capture: true, signal: ac.signal });
      row.addEventListener("dragstart", (e) => { if (ctx.held) e.preventDefault(); }, opts);

      // Tab to a film: the browser scrolls the hidden row to show it. Put that back and move the page there instead.
      row.addEventListener("focusin", (e) => {
        const t = e.target as Element, i = items.indexOf(t.closest<HTMLElement>(".mt-item")!);
        if (!ctx.held || i < 0 || !t.matches(":focus-visible")) return;
        row.scrollLeft = base;
        shiftScroll(top() + unease(i / (n - 1)) * range - scrollY);
      }, opts);

      // Left and right step one item, to that item's own place in the hold (the shares are uneven), and stop at the ends.
      row.addEventListener("keydown", (e) => {
        if (!ctx.held || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
        e.preventDefault();
        const at = Math.max(0, cur), i = clamp(at + (e.key === "ArrowRight" ? 1 : -1), 0, n - 1);
        if (i !== at) scrollTo({ top: top() + unease(i / (n - 1)) * range, behavior: "smooth" });
      }, opts);

      row.addEventListener("scroll", loose, { passive: true, signal: ac.signal });
      snap(el, ctx, n, (p) => ease(p) * (n - 1), (i) => unease(i / (n - 1)), () => down !== null, ac.signal);

      /* Hover lift (fine pointers): tilt toward the pointer, up to 9deg each way. rows.css does the rest. */
      for (const it of items) sleeveTilt(it, () => ctx.held && ctx.fine && !dragged, opts);

      // After the engine's own resize pass, so ctx is current.
      addEventListener("resize", () => requestAnimationFrame(() => {
        measure();
        if (ctx.held) return;
        track.style.transform = "";
        loose();
      }), opts);

      measure();
      loose();
      return () => {
        ac.abort();
        mo.disconnect();
        frame = () => {};
        track.style.transform = "";
        if (par) for (const k of ["data-mt-par", "data-mt-lid"]) document.documentElement.removeAttribute(k);
        for (const it of items) {
          it.classList.remove("hv");
          it.style.setProperty("--o", "0.5");
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
      const row = el.querySelector<HTMLElement>(".mt-row");
      if (!row) return;
      const items = [...el.querySelectorAll<HTMLElement>(".mt-film")];
      const n = items.length;
      if (n < 2) return;
      const ac = new AbortController();
      const opts = { signal: ac.signal };
      let cur = +(el.dataset.cur ?? 0);
      // each film rests at the middle of its share of the hold; the shares are eased like Cover art's (rows.tsx)
      snap(el, ctx, n, (p) => ease(p) * n - 0.5, (i) => unease((i + 0.5) / n), () => false, ac.signal);
      // held, the row does not scroll itself, the page does: left and right step the page one film's share of the hold
      row.addEventListener("keydown", (e) => {
        if (!ctx.held || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
        e.preventDefault();
        scrollBy({ top: ((el.offsetHeight - innerHeight) / n) * (e.key === "ArrowRight" ? 1 : -1), behavior: "smooth" });
      }, opts);
      /* Previews: a muted player in the current film, and one in the film before and after it, started and
         then paused so they are loaded when their turn comes (Julian, 2026-11-14). The poster stays on top
         until the player says it plays (same wait as video.tsx Loop). Players only ever start while the
         page rests, the current film's first, the others one at a time. */
      type Pv = { f: HTMLIFrameElement | HTMLVideoElement; yt: boolean; played: boolean; at: number; t: number };
      const win = (v: Pv) => (v.f instanceof HTMLIFrameElement ? v.f.contentWindow : null);
      const pool = new Map<number, Pv>();
      let pvT = 0, seen = false, movedAt = 0;
      addEventListener("scroll", () => (movedAt = performance.now()), { passive: true, signal: ac.signal });
      const say = (v: Pv, yt: string, vimeo: string) =>
        v.f instanceof HTMLVideoElement ? void (vimeo === "play" ? v.f.play().catch(() => {}) : v.f.pause()) : v.f.contentWindow?.postMessage(JSON.stringify(v.yt ? { event: "command", func: yt, args: [] } : { method: vimeo }), "*");
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
        /* The site's own file (data.ts FILM_FILES): a plain video, no player to wait for. It says "playing" itself. */
        if (film.dataset.file) {
          const f = document.createElement("video");
          const v: Pv = { f, yt: false, played: false, at: performance.now(), t: 0 };
          Object.assign(f, { muted: true, loop: true, playsInline: true, autoplay: true, preload: "auto", tabIndex: -1, src: film.dataset.file });
          f.setAttribute("aria-hidden", "true");
          f.addEventListener("playing", () => {
            v.played = true;
            if (i !== cur) f.pause();
            else f.setAttribute("data-ready", "");
          });
          film.append(f);
          pool.set(i, v);
          return;
        }
        const yt = src.includes("youtube");
        const f = document.createElement("iframe");
        const v: Pv = { f, yt, played: false, at: performance.now(), t: 0 };
        f.src = src + (yt ? "&enablejsapi=1" : "");
        // YouTube picks its quality from the player's size and ignores a quality setting (720p at 1440 wide, measured): rows.css draws it at twice the size, scaled back
        if (yt) f.setAttribute("data-big", "");
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
      const wants = (i: number) => i >= 0 && i < n && !!items[i].dataset.preview && !pool.has(i);
      const fill = () => {
        const next = [cur, cur + 1, cur - 1].find(wants);
        if (next === undefined) return;
        // a player takes about 300ms of the graphics thread to start: never start one mid-scroll. "Resting" is 600ms
        // with no scroll at all (between two wheel notches the page is still for a moment). The site's own file costs nothing: at once.
        if (!items[next].dataset.file && performance.now() - movedAt < 600) return void (pvT = window.setTimeout(fill, 200));
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
            v.f.removeAttribute("data-ready");
            if (v.played) say(v, "pauseVideo", "pause");
          } else if (v.played) say(v, "playVideo", "play");
        }
        pvT = window.setTimeout(fill, wants(cur) && items[cur].dataset.file ? 0 : 300);
      };
      addEventListener("message", (e) => {
        const hit = [...pool].find(([, v]) => win(v) === e.source);
        if (!hit) return;
        const [i, v] = hit;
        let m;
        try { m = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
        // Vimeo: the poster lifts only when the player says frames are moving
        if (m?.event === "ready") return void vimeoListen(win(v));
        const state = m?.event === "onStateChange" ? m.info : m?.event === "infoDelivery" ? m.info?.playerState : undefined;
        const plays = vimeoPlays(m) || state === 1;
        if (!plays && typeof state !== "number") return;
        if (plays) {
          const first = !v.played;
          v.played = true;
          if (state === 1) captionsOff(win(v));
          if (i !== cur) return void say(v, "pauseVideo", "pause");
          if (v.f.hasAttribute("data-ready") || v.t) return;
          // YouTube draws its own title and controls for a moment after a first start; a loaded one resumes clean
          v.t = window.setTimeout(() => ((v.t = 0), v.f.setAttribute("data-ready", "")), v.yt ? (first ? 2500 : 350) : 0);
        } else if (i === cur && state !== 2) {
          clearTimeout(v.t);
          v.t = 0;
          v.f.removeAttribute("data-ready");
        }
      }, opts);
      // a screen early, so the first film is already playing when the section arrives (Julian, 2026-11-17: play as soon as possible)
      const io = new IntersectionObserver(([e]) => {
        seen = e.isIntersecting;
        preview();
      }, { rootMargin: "100% 0px" });
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
      }), opts);
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

export const rowsDrivers: Driver[] = [heldRow("covers"), films()];
