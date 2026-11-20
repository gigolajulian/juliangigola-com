/* ── the booking wait's cover (the default since 2026-11-19; `?loader=fill`
 * keeps the J and G that fill, `?loader=orb` the orb) ─────────────────
 * Run as the page is read (a script in the booking page's markup), so the
 * first paint is J and G on the page's own ground, never the page and then
 * a cover over it. The cover is the ground with J and G cut out of it and
 * the ink letters over the holes (cut only once the page under is in
 * place: until then the mask letters are white, so nothing shows through);
 * `jg-load.tsx` drives the line and opens the cut when the times are in
 * (Julian, 2026-11-19: "open the booking page as a cutout and scale it
 * smoothly", then "centered"). J, G and the line are set by their ink, not
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
     show at once (Julian, 2026-11-19: "only in the calendar", "on desktop
     and iPad"); it follows the calendar's box as it is drawn. A phone: the
     whole screen. */
  const box = innerWidth >= 768 && document.querySelector("#p-flow .f-body") ? (d.dataset.box = "", true) : false;
  d.style.cssText = box ? "position:absolute;z-index:5;overflow:hidden" : "position:fixed;inset:0;z-index:2147483000";
  d.innerHTML = markup;
  // smaller over the calendar (Julian, 2026-11-19: "make the JG smaller")
  if (box) (d.querySelector("svg") as SVGSVGElement).style.fontSize = "96px";
  document.documentElement.appendChild(d);
  let el: Element | null = null;
  const ro = box && window.ResizeObserver ? new ResizeObserver(() => go()) : null;
  const fit = () => {
    const n = document.querySelector("#p-flow .f-body");
    if (!n) return;
    if (n !== el) ro?.observe((el = n));
    // from under the session cards (and the lines under them) to the foot of the column: the cards stay clear, the calendar's Month switch is covered
    const r = n.getBoundingClientRect();
    let t = r.top;
    for (const c of n.children) {
      const b = c.getBoundingClientRect();
      if (b.height && !c.matches("[role=status], .f-in") && !c.querySelector(".cal-top")) t = Math.max(t, b.bottom);
    }
    Object.assign(d.style, { left: `${r.left + scrollX}px`, top: `${t + scrollY}px`, width: `${r.width}px`, height: `${r.bottom - t}px` });
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

/** The cover as the page is read (a script in the booking page's markup). */
export const JG_COVER = `(${cover.toString()})(${place.toString()},${JSON.stringify(MARKUP)})`;
/** The cover after a move inside the site, where React runs no script it inserts (QA on #1266). */
export const mountCover = () => cover(place, MARKUP);
