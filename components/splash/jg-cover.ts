/* ── `?loader=split`: the cover the booking wait plays on ─────────────
 * Run as the page is read (a script in the booking page's markup), so the
 * first paint is J and G on the page's own ground, never the page and then
 * a cover over it. The cover is the ground with J and G cut out of it and
 * the ink letters over the holes (cut only once the page under is in
 * place: until then the mask letters are white, so nothing shows through); `jg-load.tsx` drives the line and opens
 * the cut when the times are in (Julian, 2026-11-19: "open the booking page
 * as a cutout and scale it smoothly"). Outside React, at the end of <html>,
 * so it can leave without React noticing. A page whose wait never opens it
 * (no picker on it) gets it faded away after 10 seconds.
 * ─────────────────────────────────────────────────────────────── */
const SIZE = "clamp(112px,22vw,168px)";
const letters = (fill: string) =>
  `<text x="50%" y="50%" dx="-.02em" dy=".36em" text-anchor="end" fill="${fill}">J</text><text x="50%" y="50%" dx=".02em" dy=".36em" fill="${fill}">G</text>`;
const MARKUP =
  `<style>@keyframes jg-in{from{opacity:0}}@media (prefers-reduced-motion:reduce){#jg-cover .ink{animation:none!important}}</style>` +
  `<svg width="100%" height="100%" style="position:absolute;inset:0;display:block;font:900 ${SIZE} var(--display);letter-spacing:-.05em">` +
  `<defs><mask id="jg-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%"><rect width="100%" height="100%" fill="#fff"/><g class="mg">${letters("#fff")}</g></mask></defs>` +
  `<rect class="gr" width="100%" height="100%" mask="url(#jg-cut)" style="fill:var(--bg)"/>` +
  `<g class="ink" style="fill:var(--ink);animation:jg-in .8s ease both">${letters("var(--ink)")}</g></svg>` +
  `<div class="ln" style="position:absolute;left:50%;top:50%;width:1.29em;height:2px;font-size:${SIZE};transform:translate(-50%,.58em);background:color-mix(in srgb,var(--ink) 18%,transparent);overflow:hidden">` +
  `<u style="display:block;height:100%;background:var(--ink);transform-origin:0 0;transform:scaleX(0)"></u></div>`;

export const JG_COVER = `(function(){if(new URLSearchParams(location.search).get("loader")!=="split"||document.getElementById("jg-cover"))return;var d=document.createElement("div");d.id="jg-cover";d.setAttribute("aria-hidden","true");d.dataset.at=String(performance.now());d.style.cssText="position:fixed;inset:0;z-index:2147483000";d.innerHTML=${JSON.stringify(MARKUP)};document.documentElement.appendChild(d);setTimeout(function(){if(d.isConnected&&d.dataset.go===undefined){d.dataset.go="";d.style.transition="opacity .4s";d.style.opacity="0";setTimeout(function(){d.remove()},400)}},10000)})()`;
