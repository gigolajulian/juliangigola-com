import type { Mover } from "./motion";
import { nav } from "./shared";

/* ── the crossing (preview `?cross=1`) ──
   Past the end of a project the next one comes in as a card over it,
   under the fingers and at their speed (Julian's mock, 2026-10-18). Let
   go before halfway and it eases back out; past halfway, or let go on a
   flick, it carries on by itself and lands on the next project's title,
   whatever momentum is still coming. Backwards, from the first frame, the
   project before comes in the same way from the left.

   The card is a copy of the next page's opening (`[data-cross-card]` in
   `project-strip.tsx`) laid over the page; once it covers the page the
   router goes there underneath it and the card fades off the real one. */

/** A critically damped spring with a 0.35s response, as Apple sizes a
    move: no overshoot, and it starts at the speed the fingers left it. */
const OMEGA = (2 * Math.PI) / 0.35;
/** A flick: px per ms in the leading direction at the lift. */
const FLICK = 0.5;
/** The quiet that ends a wheel push. */
const QUIET = 140;

export type Cross = {
  /** Whether a card is out. */
  active: () => boolean;
  /** The fingers moved by `by` px, positive forward. False when there
      is no card that way (a gallery's next discipline): the band has it. */
  push: (by: number) => boolean;
  /** The fingers left the glass. */
  lift: () => void;
};

export function createCross(m: Mover): Cross {
  let dir: 1 | -1 | 0 = 0;
  let x = 0;
  let v = 0;
  let at = 0;
  let raf = 0;
  let quiet = 0;
  let going = false;
  let card: HTMLElement | null = null;
  let dim: HTMLElement | null = null;
  let page: HTMLElement | null = null;
  const W = () => window.innerWidth;

  const paint = () => {
    if (!card || !dim) return;
    const w = W();
    const k = x / w;
    card.style.translate = `${(dir > 0 ? w - x : x - w).toFixed(1)}px 0`;
    dim.style.opacity = (0.28 * k).toFixed(3);
    if (page) page.style.translate = `${(-dir * 0.12 * x).toFixed(1)}px 0`;
  };

  const build = () => {
    const tpl = document.querySelector<HTMLElement>(`[data-cross-card="${dir > 0 ? "next" : "prev"}"]`);
    page = m.el.closest("main");
    if (!tpl || !page) return false;
    const box = page.getBoundingClientRect();
    const strip = m.el.getBoundingClientRect();
    const cs = getComputedStyle(m.el);
    dim = document.createElement("div");
    dim.style.cssText = `position:fixed;left:0;right:0;top:${box.top}px;height:${box.height}px;background:#000;opacity:0;z-index:34;pointer-events:none`;
    card = document.createElement("div");
    card.setAttribute("aria-hidden", "true");
    card.style.cssText = `position:fixed;left:0;width:100vw;top:${box.top}px;height:${box.height}px;z-index:35;background:var(--background);pointer-events:none;will-change:translate;box-shadow:${dir > 0 ? "-30px" : "30px"} 0 60px rgb(0 0 0 / 0.18)`;
    const row = tpl.firstElementChild!.cloneNode(true) as HTMLElement;
    row.style.cssText = `position:absolute;left:0;right:0;top:${strip.top - box.top}px;height:${strip.height}px;padding-left:${cs.paddingLeft};column-gap:${cs.columnGap}`;
    /* The frames with this page's corners. */
    const cell = m.el.querySelector<HTMLElement>(".strip-cell");
    if (cell) for (const f of row.querySelectorAll<HTMLElement>(":scope > .relative")) f.style.borderRadius = getComputedStyle(cell).borderRadius;
    /* The head: the crumb and the frame count, no title, as a page
       opens on its plate. */
    const head = page.querySelector<HTMLElement>(":scope > header, header.page-column");
    if (head) {
      const hb = head.getBoundingClientRect();
      const h = head.cloneNode(true) as HTMLElement;
      h.style.cssText += `;position:absolute;left:${hb.left}px;width:${hb.width}px;top:${hb.top - box.top}px;margin:0`;
      for (const e of h.querySelectorAll<HTMLElement>("h1, h2, h1 ~ p, h2 ~ p, img, svg")) e.style.visibility = "hidden";
      const n = tpl.dataset.count;
      for (const e of h.querySelectorAll<HTMLElement>("*"))
        if (!e.children.length && /^\d+ frames?$/i.test(e.textContent?.trim() ?? "") && n) e.textContent = `${n} frames`;
      card.append(h);
    }
    card.append(row);
    document.body.append(dim, card);
    m.el.dataset.crossing = "";
    return true;
  };

  const teardown = () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(quiet);
    card?.remove();
    dim?.remove();
    delete m.el.dataset.crossing;
    if (page) page.style.translate = "";
    card = dim = page = null;
    dir = 0;
    x = v = 0;
  };

  /** Springs `x` to `to` from where it is, at the speed it has. */
  const spring = (to: number, done: () => void) => {
    cancelAnimationFrame(raf);
    let vel = v * 1000; // px/s
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const a = -OMEGA * OMEGA * (x - to) - 2 * OMEGA * vel;
      vel += a * dt;
      x += vel * dt;
      if (Math.abs(x - to) < 0.5 && Math.abs(vel) < 20) {
        x = to;
        paint();
        return done();
      }
      paint();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  const finish = () => {
    going = true;
    const href = dir > 0 ? m.nextHref : m.prevHref;
    const from = location.pathname;
    spring(W(), () => {
      if (!href) return teardown();
      /* Lands on the title, and the push that brought it is spent: the
         arrival drops the same way's tail for a second (`wheel.ts`). */
      nav.cameBack = false;
      nav.arriveDir = dir || 1;
      m.leaving = true;
      const c = card;
      const d = dim;
      card = dim = null;
      if (page) page.style.translate = "";
      m.go(href);
      const wait = () => {
        if (location.pathname === from) return void requestAnimationFrame(wait);
        // Two frames for the page to paint under it, then off.
        window.setTimeout(() => {
          d?.remove();
          c?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out" }).finished.finally(() => c.remove());
          going = false;
        }, 260);
      };
      requestAnimationFrame(wait);
      // A navigation that never lands leaves nothing behind.
      window.setTimeout(() => {
        if (location.pathname !== from) return;
        c?.remove();
        d?.remove();
        going = false;
        m.leaving = false;
      }, 4000);
      teardown();
    });
  };

  const lift = () => {
    window.clearTimeout(quiet);
    if (!dir || going) return;
    // Still the speed of the hand, or nothing if it rested before letting go.
    if (performance.now() - at > 90) v = 0;
    if (x > W() * 0.5 || v > FLICK) finish();
    else spring(0, teardown);
  };

  const push = (by: number) => {
    if (going || m.leaving) return true;
    if (!dir) {
      const way = by > 0 ? 1 : -1;
      if (!document.querySelector(`[data-cross-card="${way > 0 ? "next" : "prev"}"]`)) return false;
      dir = way;
      if (!(dir > 0 ? m.nextHref : m.prevHref) || performance.now() - m.arrived < 500 || !build()) {
        dir = 0;
        return true;
      }
    }
    cancelAnimationFrame(raf);
    const now = performance.now();
    const dt = Math.max(1, now - at);
    at = now;
    const d = by * dir;
    v = dt > 80 ? d / dt : 0.7 * v + 0.3 * (d / dt);
    x = Math.max(0, Math.min(W(), x + d));
    paint();
    if (x === 0) {
      teardown();
      return true;
    }
    // A wheel has no lift: its quiet is one. A finger lifts for itself.
    window.clearTimeout(quiet);
    if (m.touchX === null) quiet = window.setTimeout(lift, QUIET);
    return true;
  };

  return { active: () => dir !== 0, push, lift };
}
