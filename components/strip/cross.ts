import { gsap } from "gsap";
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
/** The quiet that ends a wheel push. Long enough that a stalled frame
    in a momentum stream is not taken for a lift (QA, 2026-10-19). */
const QUIET = 120;
/** How long a wheel's card holds where it was left before it goes back:
    swipes a beat apart add up, as one push; Safari leaves over a second
    between swipes (QA, MAC, 2026-10-19). */
const HOLD_BACK = 1500;

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
  let tl: gsap.core.Timeline | null = null;
  /** The title's words and their text, wrapped for the rise. */
  let words: [HTMLElement, string][] = [];
  const W = () => window.innerWidth;
  /* The cards' photographs decoded ahead, while the page is idle: laid out
     invisible they never are, and decoded mid slide the card ran at 20fps
     (QA, 2026-10-19). One shared decode, so the copy gets it too. */
  window.setTimeout(() => {
    for (const i of document.querySelectorAll<HTMLImageElement>("[data-cross-card] img")) i.decode().catch(() => {});
  }, 1200);

  const paint = () => {
    if (!card || !dim) return;
    const w = W();
    const k = x / w;
    card.style.translate = `${(dir > 0 ? w - x : x - w).toFixed(1)}px 0`;
    dim.style.opacity = (0.28 * k).toFixed(3);
    if (page) page.style.translate = `${(-dir * 0.12 * x).toFixed(1)}px 0`;
    tl?.progress(k);
  };

  const build = () => {
    const tpl = document.querySelector<HTMLElement>(`[data-cross-card="${dir > 0 ? "next" : "prev"}"]`);
    page = m.el.closest("main");
    if (!tpl || !page) return false;
    const box = page.getBoundingClientRect();
    const strip = m.el.getBoundingClientRect();
    const cs = getComputedStyle(m.el);
    /* Down to the footer, not over it: the dim greyed its text for the
       length of every crossing (QA, 2026-10-19). */
    const foot = [...document.querySelectorAll("footer")].pop()?.getBoundingClientRect().top;
    const tall = Math.min(box.bottom, foot ?? Infinity) - box.top;
    dim = document.createElement("div");
    dim.style.cssText = `position:fixed;left:0;right:0;top:${box.top}px;height:${tall}px;background:#000;opacity:0;z-index:34;pointer-events:none`;
    card = document.createElement("div");
    card.setAttribute("aria-hidden", "true");
    card.style.cssText = `position:fixed;left:0;width:100vw;top:${box.top}px;height:${tall}px;overflow:hidden;z-index:35;background-color:var(--background);background-image:var(--ground);background-size:100vw 100vh;background-position:0 ${-box.top}px;pointer-events:none;will-change:translate;clip-path:inset(0 -120px);box-shadow:${dir > 0 ? "-30px" : "30px"} 0 60px rgb(0 0 0 / 0.18)`;
    const row = tpl.firstElementChild!.cloneNode(true) as HTMLElement;
    row.style.cssText = `position:absolute;left:0;right:0;top:${strip.top - box.top}px;height:${strip.height}px;${dir > 0 ? "padding-left" : "padding-right"}:${cs.paddingLeft};column-gap:${cs.columnGap}`;
    /* The frames with this page's corners. */
    const cell = m.el.querySelector<HTMLElement>(".strip-cell");
    if (cell) for (const f of row.querySelectorAll<HTMLElement>(":scope > .relative")) f.style.borderRadius = getComputedStyle(cell).borderRadius;
    /* The head: the crumb and the frame count, no title, as a page
       opens on its plate. Backwards it lands past the plate, where the
       head carries the title (`running-head`), so the card's does. */
    const head = page.querySelector<HTMLElement>(":scope > header, header.page-column");
    if (head) {
      const hb = head.getBoundingClientRect();
      const h = head.cloneNode(true) as HTMLElement;
      h.style.cssText += `;position:absolute;left:${hb.left}px;width:${hb.width}px;top:${hb.top - box.top}px;margin:0`;
      for (const e of h.querySelectorAll<HTMLElement>(dir > 0 ? "h1, h2, h1 ~ p, h2 ~ p, img, svg" : "img, svg")) e.style.visibility = "hidden";
      if (dir < 0) {
        const t = h.querySelector<HTMLElement>("h1, h2");
        const sub = t?.parentElement?.querySelector<HTMLElement>("p");
        if (t) t.textContent = tpl.dataset.title ?? "";
        if (sub) sub.textContent = tpl.dataset.sub ?? "";
        for (const e of h.querySelectorAll<HTMLElement>(".running-head")) e.style.opacity = "1";
      }
      const n = tpl.dataset.count;
      for (const e of h.querySelectorAll<HTMLElement>("*"))
        if (!e.children.length && /^\d+ frames?$/i.test(e.textContent?.trim() ?? "") && n) e.textContent = `${n} frames`;
      card.append(h);
    }
    /* The rail comes in with the card, already at the next project's
       first frame: left under the card it went out and came back
       (Julian, 2026-10-19). */
    const rail = page.querySelector<HTMLElement>(".strip-rail");
    const off = rail && [...rail.querySelectorAll<HTMLElement>("[data-mark]")].find((e) => !e.hasAttribute("data-ink"));
    const n = Number(tpl.dataset.count);
    if (rail && off && n) {
      const rb = rail.getBoundingClientRect();
      const r = rail.cloneNode(false) as HTMLElement;
      r.style.cssText += `;position:absolute;left:${rb.left}px;width:${rb.width}px;top:${rb.top - box.top}px;margin:0`;
      const count = rail.querySelector(".strip-count")?.cloneNode(false) as HTMLElement | undefined;
      if (count) {
        const nn = String(n).padStart(2, "0");
        count.innerHTML = `<span class="text-foreground">${dir > 0 ? "01" : nn}</span> / ${nn}`;
        r.append(count);
      }
      const line = off.parentElement!.parentElement!.cloneNode(false) as HTMLElement;
      for (let i = 0; i < n; i++) {
        const b = off.parentElement!.cloneNode(false) as HTMLElement;
        const k = off.cloneNode(false) as HTMLElement;
        if (i === (dir > 0 ? 0 : n - 1)) k.className = k.className.replace("scale-y-50 bg-foreground/20", "rail-lit scale-y-100 bg-foreground");
        b.append(k);
        line.append(b);
      }
      r.append(line);
      card.append(r);
    }
    card.append(row);
    document.body.append(dim, card);
    /* Each line of the title rises from behind its own lower edge, then
       the credits build up: the rule drawn, the lines rising one by one.
       Scrubbed by the card, so it moves with the fingers and back, and is
       at rest by the time it lands: nothing plays again on the page
       (Julian, 2026-10-19). */
    words = [...card.querySelectorAll<HTMLElement>(".title-word")].map((w) => [w, w.textContent ?? ""]);
    const lines = words.map(([w, t]) => {
      w.textContent = "";
      const s = document.createElement("span");
      s.textContent = t;
      s.style.display = "inline-block";
      w.append(s);
      w.style.clipPath = "inset(-0.3em -0.3em 0 -0.3em)";
      return s;
    });
    const dl = card.querySelector<HTMLElement>("dl");
    tl = gsap
      .timeline({ paused: true })
      .from(lines, { yPercent: 110, duration: 0.6, ease: "power3.out", stagger: 0.18 }, 0)
      // Once the title is up.
      .from(dl, { clipPath: "inset(0 100% 0 0)", duration: 0.35, ease: "power2.inOut" }, ">")
      .from(dl ? dl.querySelectorAll("dt, dd") : [], { y: 18, opacity: 0, duration: 0.3, ease: "power3.out", stagger: 0.06 }, "<0.12");
    /* Its own layer while it is nudged under the card: unpromoted, every
       frame of the slide repainted the page (QA, 15fps backwards). */
    page.style.willChange = "translate";
    m.el.dataset.crossing = "";
    return true;
  };

  const teardown = () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(quiet);
    tl?.kill();
    tl = null;
    words = [];
    card?.remove();
    dim?.remove();
    delete m.el.dataset.crossing;
    if (page) page.style.translate = page.style.willChange = "";
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
      // Within 2px it is there: the last of a spring is a crawl nobody reads.
      if (Math.abs(x - to) < 2 && Math.abs(vel) < 60) {
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
      // Back lands at the project's end (`arrival.ts`), forward on its title.
      const back = dir < 0;
      nav.cameBack = back;
      nav.arriveDir = dir || 1;
      nav.crossedAt = Date.now();
      m.leaving = true;
      const c = card;
      const d = dim;
      card = dim = null;
      if (page) page.style.translate = "";
      /* The router's own page trip would snapshot this page as a layer
         over the card and fade it out: Julian saw the old page flash
         back. Muted, and the card named so it stays on top of the new
         page while the trip runs (`portfolio.css`). */
      document.documentElement.dataset.nav = "cross";
      c?.style.setProperty("view-transition-name", "cross-card");
      // Whole words again before the swap, unclipped, as the page's are.
      for (const [w, t] of words) {
        w.textContent = t;
        w.style.clipPath = "";
      }
      words = [];
      m.go(href);
      /* Off only once the page under it is the picture on it: its title
         at the card's size (the type pass sets it some 300ms after the
         page mounts, Julian's recording 2026-10-19), held two frames, and
         its first frame painted. Then gone in one frame, nothing faded. */
      const want = back ? 0 : parseFloat(getComputedStyle(c?.querySelector("h2") ?? document.body).fontSize);
      let landed = 0;
      let still = 0;
      let seen = "";
      const wait = () => {
        if (location.pathname === from) return void requestAnimationFrame(wait);
        landed ||= performance.now();
        const t = document.querySelector<HTMLElement>("main .project-plate > h2");
        const imgs = document.querySelectorAll<HTMLImageElement>("main .strip-cell img");
        const img = imgs[back ? imgs.length - 1 : 0];
        const sized = back || !t || Math.abs(parseFloat(getComputedStyle(t).fontSize) - want) < 0.5;
        /* And every heading sized by the type pass, which writes each one
           inline: the head's h1 stepped 30 to 32px 300 to 700ms in (QA,
           WebKit). */
        const heads = [...document.querySelectorAll<HTMLElement>("main h1, main h2")];
        const sizes = heads.map((e) => e.style.fontSize).join();
        still = sized && heads.every((e) => e.style.fontSize) && sizes === seen ? still + 1 : 0;
        seen = sizes;
        const ready = still >= 2 && (!img || (img.complete && img.naturalWidth > 0));
        if (!ready && performance.now() - landed < 1500) return void requestAnimationFrame(wait);
        d?.remove();
        c?.remove();
        going = false;
      };
      requestAnimationFrame(wait);
      // A navigation that never lands leaves nothing behind.
      window.setTimeout(() => {
        if (location.pathname !== from) return;
        if (document.documentElement.dataset.nav === "cross") delete document.documentElement.dataset.nav;
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
    /* A finger that rested before it lifted threw nothing. A wheel's
       quiet is the lift itself, so it hands the spring the speed it had:
       zeroed, the card stopped dead for the quiet and then lurched
       (trace, 2026-10-19). */
    if (m.touchX !== null && performance.now() - at > 90) v = 0;
    if (x > W() * 0.5 || v > FLICK) return finish();
    const left = HOLD_BACK - (performance.now() - at);
    if (m.touchX === null && left > 0) {
      quiet = window.setTimeout(lift, left);
      return;
    }
    v = 0;
    spring(0, teardown);
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
