/* ── the booking wait's cover (the default since 2026-11-19; `?loader=fill`
 * keeps the J and G that fill, `?loader=orb` the orb) ─────────────────
 * Run as the page is read (a script in the booking page's markup), so the
 * first paint is J and G on the page's own ground, never the page and then
 * a cover over it. The cover is the ground with J and G cut out of it and
 * the ink letters over the holes (cut only once the page under is in
 * place: until then the mask letters are white, so nothing shows through);
 * `jg-load.tsx` drives the line and opens the cut when the times are in.
 * J, G and the line are set by their ink, not
 * their boxes, so the mark sits in the middle of the screen; set again when
 * the face loads and on resize. The point where J meets G is kept for the
 * cut to grow from (`data-ox`, `data-oy`). Outside React, at the end of
 * <html>, so it can leave without React noticing. A page whose wait never
 * opens it (no picker on it) gets it faded away after 10 seconds.
 * ─────────────────────────────────────────────────────────────── */
const SIZE = "clamp(112px,22vw,168px)";
const letters = (fill: string) => `<text class="j" fill="${fill}">J</text><text class="g" fill="${fill}">G</text>`;
const MARKUP =
  `<style>@keyframes jg-in{from{opacity:0}}@media (prefers-reduced-motion:reduce){#jg-cover .ink{animation:none!important}}</style>` +
  `<svg width="100%" height="100%" style="position:absolute;inset:0;display:block;font:900 ${SIZE} var(--display)">` +
  `<defs><mask id="jg-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="#fff"/><g class="mg">${letters("#fff")}<ellipse class="ct" fill="#000" rx="0" ry="0"/></g></mask></defs>` +
  `<rect class="gr" width="100%" height="100%" mask="url(#jg-cut)" style="fill:var(--bg)"/>` +
  `<g class="ink" style="fill:var(--ink);animation:jg-in .8s ease both">${letters("var(--ink)")}</g></svg>` +
  `<div class="ln" style="position:absolute;height:2px;background:color-mix(in srgb,var(--ink) 18%,transparent);overflow:hidden">` +
  `<u style="display:block;height:100%;background:var(--ink);transform-origin:0 0;transform:scaleX(0)"></u></div>`;

/* Lay J, G and the line out by their ink: 0.04em between the letters, the
   line 0.2em under the baseline, the whole group centred on the screen.
   The ink is read off a canvas the letters are drawn on: WebKit's
   measureText gives no ink box for this face (its left is 0, its right the
   advance), so the mark sat off centre and J and G never closed (JG - MAC
   on #1257). Sent to the page as source (`toString`), so it touches
   nothing but globals. */
function place(d: HTMLElement) {
  const svg = d.querySelector("svg") as SVGSVGElement, cs = getComputedStyle(svg), fs = parseFloat(cs.fontSize);
  const W = Math.ceil(fs * 1.6), H = Math.ceil(fs * 1.4), X = fs * 0.3, Y = fs * 1.1;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  const ink = (ch: string) => {
    c.clearRect(0, 0, W, H);
    c.font = `900 ${fs}px ${cs.fontFamily}`;
    c.fillText(ch, X, Y);
    const a = c.getImageData(0, 0, W, H).data;
    let l = W, r = -1, t = H;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (a[(y * W + x) * 4 + 3] > 127) {
          if (x < l) l = x;
          if (x > r) r = x;
          if (y < t) t = y;
        }
    return r < 0 ? { l: 0, r: fs * 0.6, asc: fs * 0.72 } : { l: l - X, r: r + 1 - X, asc: Y - t };
  };
  const J = ink("J"), G = ink("G");
  const jl = J.l, jr = J.r, gl = G.l, gr = G.r;
  const asc = Math.max(J.asc, G.asc), gap = fs * 0.04, under = fs * 0.2;
  const w = jr - jl + gap + gr - gl, cx = d.clientWidth / 2, cy = d.clientHeight / 2;
  const base = cy + (asc - under) / 2, xj = cx - w / 2 - jl, xg = cx - w / 2 + (jr - jl) + gap - gl;
  d.querySelectorAll("text").forEach((t) => {
    t.setAttribute("x", String(t.classList.contains("j") ? xj : xg));
    t.setAttribute("y", String(base));
  });
  Object.assign((d.querySelector(".ln") as HTMLElement).style, { left: `${cx - w / 2}px`, width: `${w}px`, top: `${base + under}px` });
  // where J meets G, half way up the caps; and how far each moves to close over it
  Object.assign(d.dataset, { ox: String(cx - w / 2 + (jr - jl) + gap / 2), oy: String(base - asc / 2), close: String(gap / 2 + fs * 0.03) });
  // the inside of the G, which the cut closes like an iris as it grows (JG - MAC: it crossed the face as a wedge)
  const ct = d.querySelector(".ct") as SVGEllipseElement;
  // set a tenth right of the G's middle and wide enough to take its mouth beside the bar too
  ct.setAttribute("cx", String(xg + (gl + gr) / 2 + (gr - gl) * 0.1));
  ct.setAttribute("cy", String(base - G.asc / 2));
  Object.assign(ct.dataset, { rx: String((gr - gl) * 0.4), ry: String((G.asc / 2) * 0.68) });
}

/* Puts the cover up, once. Sent to the page as source too (`JG_COVER`), so
   it takes its pieces as arguments and touches nothing but globals. */
function cover(lay: (d: HTMLElement) => void, markup: string) {
  const l = new URLSearchParams(location.search).get("loader");
  if ((l && l !== "split") || document.getElementById("jg-cover")) return;
  const d = document.createElement("div");
  d.id = "jg-cover";
  d.setAttribute("aria-hidden", "true");
  d.dataset.at = String(performance.now());
  /* iPad and desktop: over the calendar only, the steps, title and cards
     show at once; it follows the calendar's box as it is drawn. A phone: the
     whole screen. */
  // under the session cards (and the lines under them): where the calendar starts
  const top = (n: Element) => {
    let t = n.getBoundingClientRect().top;
    for (const c of n.children) {
      const b = c.getBoundingClientRect();
      if (b.height && !c.matches("[role=status], .f-in") && !c.querySelector(".cal-top")) t = Math.max(t, b.bottom);
    }
    return t;
  };
  /* The whole screen on an upright screen, or when the calendar starts out of view: upright, the box sits below
     the fold and nothing would show. */
  const f0 = document.querySelector("#p-flow .f-body");
  const box = innerWidth >= 768 && innerWidth > innerHeight && f0 && top(f0) < innerHeight - 240 ? (d.dataset.box = "", true) : false;
  d.style.cssText = box ? "position:absolute;z-index:5;overflow:hidden" : "position:fixed;inset:0;z-index:2147483000";
  d.innerHTML = markup;
  // smaller over the calendar
  if (box) (d.querySelector("svg") as SVGSVGElement).style.fontSize = "96px";
  document.documentElement.appendChild(d);
  let el: Element | null = null;
  const ro = box && window.ResizeObserver ? new ResizeObserver(() => go()) : null;
  const fit = () => {
    const n = document.querySelector("#p-flow .f-body");
    if (!n) return;
    if (n !== el) ro?.observe((el = n));
    // from under the session cards (and the lines under them) to the foot of the column: the cards stay clear, the calendar's Month switch is covered
    const r = n.getBoundingClientRect(), t = top(n), h = r.bottom - t;
    // hidden until the calendar gives it room: before that it was a 22px strip with the top of J and G peeking (JG - MAC)
    Object.assign(d.style, { left: `${r.left + scrollX}px`, top: `${t + scrollY}px`, width: `${r.width}px`, height: `${h}px`, visibility: h < 160 ? "hidden" : "" });
  };
  // `hand`: the picker is being drawn under it, so the mark holds still while the box grows to the calendar
  const go = () => {
    if (!d.isConnected) return ro?.disconnect();
    if (box) fit();
    if (d.dataset.go === undefined && d.dataset.hand === undefined) lay(d);
  };
  go();
  if (document.fonts) document.fonts.ready.then(go);
  addEventListener("resize", go);
  setTimeout(() => {
    if (d.isConnected && d.dataset.go === undefined) {
      d.dataset.go = "";
      d.style.transition = "opacity .4s";
      d.style.opacity = "0";
      setTimeout(() => d.remove(), 400);
    }
  }, 10000);
}

/* The cut opens: J and G close over the middle, the cut grows from where
   they meet while their ink fades, and the page rises into place from
   below, straight up on every screen. It lands as the ground finishes fading, so nothing is still
   settling once the cover is gone. Once per cover; the
   ground is the page's own colour all the way, so no frame is black. */
export function reveal(cover: HTMLElement) {
  // inside, so the function also runs as source on its own (`JG_INNER`)
  const REVEAL = 1200; // the cut growing until the page fills the screen
  const BIG = 60; // how far the cut grows; the ground is gone before that
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // in-out cubic, over the log of the scale
  if (cover.dataset.go) return;
  cover.dataset.go = "";
  cover.style.pointerEvents = "none";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return cover.remove();
  const ink = cover.querySelector<SVGGElement>(".ink");
  const ln = cover.querySelector<HTMLElement>(".ln");
  const mg = cover.querySelector<SVGGElement>(".mg");
  const gr = cover.querySelector<SVGRectElement>(".gr");
  if (!ink || !ln || !mg || !gr) return cover.remove();
  // where J meets G, the middle of the mark, in the middle of the screen (`jg-cover.ts`)
  const ox = Number(cover.dataset.ox) || cover.clientWidth / 2, oy = Number(cover.dataset.oy) || cover.clientHeight / 2;
  const close = Number(cover.dataset.close) || 0;
  const ct = mg.querySelector<SVGEllipseElement>(".ct");
  const ctx = Number(ct?.getAttribute("cx"));
  /* From below: the session photo's middle under the mark where the layout
     allows (a phone, the photo on top), a fifth of the screen at least. */
  // over the calendar only (iPad, desktop): the rest of the page is already in place and stays still
  const page = cover.dataset.box === undefined ? document.getElementById("p-flow") : null;
  const ph = page?.querySelector(".ph")?.getBoundingClientRect();
  const pr = page?.getBoundingClientRect();
  const rise = Math.max(innerHeight * 0.2, ph && ph.height > 0 ? oy - (ph.top + ph.height / 2) : 0);
  if (page && pr) {
    page.style.transformOrigin = `${ox - pr.left}px ${oy - pr.top}px`;
    page.style.willChange = "transform";
  }
  const settle = (p: number) => {
    if (!page) return;
    // a touch smaller to its size, never larger: scaled up, the page scrolled sideways while it settled (QA: 147px at 1440)
    const e = ease(Math.min(1, p / 0.85));
    page.style.transform = e < 1 ? `translateY(${rise * (1 - e)}px) scale(${0.94 + 0.06 * e})` : "";
  };
  /* The ink stays in the letters until they are big enough to show the page
     (a small window onto it reads as an empty letter), and the ground fades
     while the cut is still a size Chrome draws: text past a few thousand px
     stops rendering and the whole cover flashed solid. */
  // over the calendar only, 4 times is past the box's edges and the letters never showed the page (Julian: "the cutout doesn't show what's under it")
  const off = page ? 4 : 1.25;
  const frame = (p: number) => {
    const e = ease(p), k = Math.exp(Math.log(BIG) * e);
    mg.setAttribute("transform", `translate(${ox} ${oy}) scale(${k}) translate(${-ox} ${-oy})`);
    ink.setAttribute("transform", `translate(${ox} ${oy}) scale(${k}) translate(${-ox} ${-oy})`);
    /* Off in one frame at 4 times its size, when the letters show a good
       piece of the page on any screen: faded, it read as a grey veil over
       the page (JG - MAC, Safari); empty sooner over the dark calendar. */
    ink.style.opacity = k < off ? "1" : "0";
    // the G's inside is cut in the same frame, so no piece of ground crosses the face as the cut grows (closing it over a few frames still showed it)
    if (ct && k >= off && ct.getAttribute("rx") === "0") {
      ct.setAttribute("rx", ct.dataset.rx ?? "0");
      ct.setAttribute("ry", ct.dataset.ry ?? "0");
    }
    // the ground only once the ink is off, or the page showed dim behind solid letters
    gr.style.opacity = String(Math.min(1, Math.max(0, 1 - (p - 0.47) / 0.38)));
    settle(p);
  };
  ink.getAnimations().forEach((a) => a.cancel());
  frame(0);
  mg.querySelectorAll("text").forEach((t) => t.setAttribute("fill", "#000"));
  ln.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: "ease", fill: "forwards" });
  // J and G close over the middle first, so the point the cut grows from is inside a letter, not the gap
  const texts = [...cover.querySelectorAll<SVGTextElement>("text")].map((t) => ({ t, x: Number(t.getAttribute("x")), dir: t.classList.contains("j") ? 1 : -1 }));
  const t0 = performance.now();
  const step = (now: number) => {
    const c = Math.min(1, (now - t0) / 240), ce = 1 - (1 - c) ** 3;
    for (const { t, x, dir } of texts) t.setAttribute("x", String(x + dir * close * ce));
    if (ct) ct.setAttribute("cx", String(ctx - close * ce)); // with the G
    const p = Math.min(1, Math.max(0, (now - t0 - 120) / REVEAL));
    frame(p);
    if (p < 1) return requestAnimationFrame(step);
    cover.remove();
    if (page) page.style.transform = page.style.transformOrigin = page.style.willChange = "";
  };
  requestAnimationFrame(step);
}

/* A first arrival on an inner page (`data-cover-intro`, `layout.tsx`, Julian 2026-11-21: "A, once per visit"): the
   cover is put up as the page is read and opened from here too, without waiting for the page's scripts. The line
   creeps as on the booking wait; once the document is read and the pictures on screen have loaded (3s at most),
   and J and G have shown their least, it fills and the cut opens (`reveal`). */
function drive(open: (c: HTMLElement) => void) {
  const d = document.getElementById("jg-cover");
  if (!d) return;
  const bar = d.querySelector<HTMLElement>(".ln u");
  const at = Number(d.dataset.at) || performance.now();
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let readyAt = 0, from = 0, shown = 0;
  const ready = () => {
    if (!readyAt) readyAt = -1;
  };
  const check = () => {
    const on = [...document.images].filter((i) => {
      const r = i.getBoundingClientRect();
      return r.width > 0 && r.top < innerHeight && r.bottom > 0;
    });
    if (on.every((i) => i.complete)) ready();
  };
  const read = () => {
    check();
    document.addEventListener("load", check, true);
    setTimeout(ready, 3000);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", read, { once: true });
  else read();
  const tick = (now: number) => {
    if (!d.isConnected) return;
    if (readyAt === -1 && (still || now - at >= 800)) {
      readyAt = now;
      from = shown;
    }
    if (readyAt <= 0) shown = 90 * (1 - Math.exp(-(now - at) / 900));
    else {
      const k = still ? 1 : Math.min(1, (now - readyAt) / 240);
      shown = from + (100 - from) * (1 - (1 - k) ** 3);
    }
    if (bar) bar.style.transform = `scaleX(${shown / 100})`;
    if (shown >= 100) {
      document.removeEventListener("load", check, true);
      setTimeout(() => open(d), 60);
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** The cover as the page is read (a script in the booking page's markup). */
export const JG_COVER = `(${cover.toString()})(${place.toString()},${JSON.stringify(MARKUP)})`;
/** The cover after a move inside the site, where React runs no script it inserts (QA on #1266). */
export const mountCover = () => cover(place, MARKUP);
/** The cover for a first arrival on an inner page, put up and opened as the page is read (`layout.tsx`). */
export const JG_INNER = `${JG_COVER};(${drive.toString()})(${reveal.toString()})`;
