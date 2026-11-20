/* ── `?loader=split`: the cover the booking wait plays on ─────────────
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
  `<defs><mask id="jg-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="#fff"/><g class="mg">${letters("#fff")}</g></mask></defs>` +
  `<rect class="gr" width="100%" height="100%" mask="url(#jg-cut)" style="fill:var(--bg)"/>` +
  `<g class="ink" style="fill:var(--ink);animation:jg-in .8s ease both">${letters("var(--ink)")}</g></svg>` +
  `<div class="ln" style="position:absolute;height:2px;background:color-mix(in srgb,var(--ink) 18%,transparent);overflow:hidden">` +
  `<u style="display:block;height:100%;background:var(--ink);transform-origin:0 0;transform:scaleX(0)"></u></div>`;

/* Lay J, G and the line out by their ink: 0.04em between the letters, the
   line 0.2em under the baseline, the whole group centred on the screen.
   Sent to the page as source (`toString`), so it touches nothing but globals. */
function place(d: HTMLElement) {
  const svg = d.querySelector("svg") as SVGSVGElement, cs = getComputedStyle(svg), fs = parseFloat(cs.fontSize);
  const c = document.createElement("canvas").getContext("2d") as CanvasRenderingContext2D;
  c.font = `900 ${fs}px ${cs.fontFamily}`;
  const J = c.measureText("J"), G = c.measureText("G");
  const jl = -J.actualBoundingBoxLeft, jr = J.actualBoundingBoxRight, gl = -G.actualBoundingBoxLeft, gr = G.actualBoundingBoxRight;
  const asc = Math.max(J.actualBoundingBoxAscent, G.actualBoundingBoxAscent), gap = fs * 0.04, under = fs * 0.2;
  const w = jr - jl + gap + gr - gl, cx = innerWidth / 2, cy = innerHeight / 2;
  const base = cy + (asc - under) / 2, xj = cx - w / 2 - jl, xg = cx - w / 2 + (jr - jl) + gap - gl;
  d.querySelectorAll("text").forEach((t) => {
    t.setAttribute("x", String(t.classList.contains("j") ? xj : xg));
    t.setAttribute("y", String(base));
  });
  Object.assign((d.querySelector(".ln") as HTMLElement).style, { left: `${cx - w / 2}px`, width: `${w}px`, top: `${base + under}px` });
  // where J meets G, half way up the caps; and how far each moves to close over it
  Object.assign(d.dataset, { ox: String(cx - w / 2 + (jr - jl) + gap / 2), oy: String(base - asc / 2), close: String(gap / 2 + fs * 0.03) });
}

export const JG_COVER = `(function(){if(new URLSearchParams(location.search).get("loader")!=="split"||document.getElementById("jg-cover"))return;var place=${place.toString()};var d=document.createElement("div");d.id="jg-cover";d.setAttribute("aria-hidden","true");d.dataset.at=String(performance.now());d.style.cssText="position:fixed;inset:0;z-index:2147483000";d.innerHTML=${JSON.stringify(MARKUP)};document.documentElement.appendChild(d);var go=function(){if(d.isConnected&&d.dataset.go===undefined)place(d)};go();document.fonts&&document.fonts.ready.then(go);addEventListener("resize",go);setTimeout(function(){if(d.isConnected&&d.dataset.go===undefined){d.dataset.go="";d.style.transition="opacity .4s";d.style.opacity="0";setTimeout(function(){d.remove()},400)}},10000)})()`;
