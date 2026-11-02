/**
 * /visit: directions, parking and the entrance for client shoots at the studio.
 *
 * Unlisted on purpose. Julian sends the link to booked clients; nothing on the
 * site links here, the sitemap leaves it out, and the page says noindex, as
 * do the headers (`next.config.ts` for the Worker, `public/_headers` for the
 * prerendered copy Cloudflare serves without it).
 *
 * A standalone document rather than a page under the root layout: it is a
 * full-screen 3D map with its own small chrome, and none of the site's bar,
 * splash or transitions belong on it. The scene lives in `public/visit/map.js`,
 * with three.js r128 vendored beside it and the site's fonts copied in, since
 * the CSP only lets scripts and fonts come from this origin.
 *
 * Built from OpenStreetMap outlines (credited in the page footer). The source
 * for the scene data and the copy is the studio map artifact; regenerate both
 * files together.
 */
export const dynamic = "force-static";

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Getting to the studio | Julian Gigola</title>
<meta name="description" content="Directions, parking and the entrance for the studio at Latitude 37, San Jose.">
<meta property="og:title" content="Getting to the studio">
<meta property="og:description" content="Directions, parking and the entrance at Latitude 37, San Jose.">
<meta name="theme-color" content="#0b0a09">
<link rel="icon" href="/favicon.ico">
<style>
/* Layout: the juliangigola.com ground. Live 3D block on the left, directions on a lifted card at right; stacked on phones. */
:root {
  --bg: oklch(0.145 0.003 70);
  --card: oklch(0.185 0.003 70);
  --secondary: oklch(0.245 0.003 70);
  --ink: oklch(0.955 0.004 80);
  --muted: oklch(0.655 0.005 80);
  --line: oklch(1 0 0 / 11%);
  --accent: oklch(0.72 0.095 195);
  /* the same tokens in hex, for the WebGL scene */
  --gl-bg: #0b0a09;
  --gl-ink: #f1f0ed;
  --gl-accent: #50b7b7;
  --gl-danger: #e64343;
  --danger: oklch(0.62 0.2 25);
  --ground: radial-gradient(125vw 75vh at 50vw -12vh, oklch(0.19 0.004 70), oklch(0.178 0.004 70 / 0.6) 30%, oklch(0.165 0.003 70 / 0.25) 55%, transparent 80%),
    radial-gradient(70vw 65vh at 0 100vh, oklch(0.11 0.003 70 / 0.85), oklch(0.12 0.003 70 / 0.35) 50%, transparent),
    radial-gradient(70vw 65vh at 100vw 100vh, oklch(0.11 0.003 70 / 0.85), oklch(0.12 0.003 70 / 0.35) 50%, transparent),
    var(--bg);
  --display: "Inter Tight", "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
  --radius: 2px;
  --ease: cubic-bezier(0.23, 1, 0.32, 1);
  color-scheme: dark;
}
html, body { height: 100%; }
body { background: var(--bg); color: var(--ink); font-family: var(--display); font-weight: 500; font-size: 15px; line-height: 1.5; }
.label { font: 500 11px/1.2 var(--mono); letter-spacing: .14em; text-transform: uppercase; }
.app { display: grid; grid-template-columns: minmax(0, 1fr) 380px; height: 100%; background: var(--ground); }
.stage { position: relative; min-width: 0; overflow: hidden; }
#gl { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
#gl:active { cursor: grabbing; }
.labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.lbl { position: absolute; left: 0; top: 0; white-space: nowrap; will-change: transform; visibility: hidden; }
.lbl.street { font: 500 10.5px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); }
.lbl.street.route { color: var(--ink); }
.lbl.dim { opacity: .6; }
.lbl.place { font: 700 19px/1 var(--display); letter-spacing: -0.035em; color: var(--ink); }
/* the P markers in the same thin glass as the entrance tag, so they sit in the scene instead of on top of it */
.lbl.p { width: 20px; height: 20px; display: grid; place-items: center; border-radius: var(--radius); font: 700 12px/1 var(--display); color: var(--ink);
  background: color-mix(in oklab, var(--bg) 26%, transparent); -webkit-backdrop-filter: blur(24px) saturate(1.9) brightness(1.06); backdrop-filter: blur(24px) saturate(1.9) brightness(1.06);
  box-shadow: 0 8px 22px -12px color-mix(in oklab, black 55%, transparent); }
@media (prefers-reduced-transparency: reduce) { .lbl.p { background: var(--card); -webkit-backdrop-filter: none; backdrop-filter: none; } }
.lbl.transit { display: grid; gap: 4px; padding: 7px 10px; border-radius: var(--radius); background: var(--card); color: var(--ink); box-shadow: 0 6px 24px oklch(0 0 0 / 45%); }
.lbl.transit b { font: 700 15px/1 var(--display); letter-spacing: -0.02em; }
.lbl.transit span { font: 500 10px/1 var(--mono); color: var(--muted); letter-spacing: .14em; text-transform: uppercase; }
.lbl.door { display: flex; align-items: center; gap: 8px; padding: 7px 11px; border-radius: var(--radius); color: var(--ink); font: 700 11px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase;
  /* the site's liquid glass (app/styles/glass.css), thinner and with no edge: the map blurs and saturates through it */
  background: color-mix(in oklab, var(--bg) 26%, transparent);
  -webkit-backdrop-filter: blur(24px) saturate(1.9) brightness(1.06); backdrop-filter: blur(24px) saturate(1.9) brightness(1.06);
  box-shadow: 0 12px 32px -14px color-mix(in oklab, black 55%, transparent); }
@media (prefers-reduced-transparency: reduce) { .lbl.door { background: var(--card); -webkit-backdrop-filter: none; backdrop-filter: none; } }
.lbl.door b { font: 700 14px/1 var(--display); letter-spacing: -0.02em; text-transform: none; }

.hud { position: absolute; left: max(14px, env(safe-area-inset-left, 0px)); bottom: 14px; display: flex; gap: 6px; flex-wrap: wrap; }
.hud button { font: 500 11px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--ink); background: oklch(0.185 0.003 70 / 0.9); border: 0; border-radius: var(--radius); padding: 11px 13px; cursor: pointer; backdrop-filter: blur(8px); transition: color var(--dur, 200ms) var(--ease), background var(--dur, 200ms) var(--ease); }
.hud button:hover { color: var(--accent); }
.hud button[aria-pressed="true"] { background: var(--ink); color: var(--bg); }
.hud button:focus-visible, .copy:focus-visible, .go:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.compass { position: absolute; right: 14px; top: 14px; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; background: oklch(0.185 0.003 70 / 0.9); }
.compass span { font: 700 10px/1 var(--mono); color: var(--ink); display: flex; flex-direction: column; align-items: center; gap: 2px; }
.compass i { width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 8px solid var(--ink); }
.viewtoast { position: absolute; left: 14px; top: 14px; padding: 8px 10px; border-radius: var(--radius); background: var(--card); outline: 1px solid var(--accent); font: 400 12px/1.3 var(--mono); color: var(--ink); user-select: all; }
.hint { position: absolute; right: 14px; bottom: 18px; font: 500 10px/1.4 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--muted); text-align: right; pointer-events: none; }

aside { background: var(--card); overflow-y: auto; padding-block: 30px 32px; padding-left: max(26px, env(safe-area-inset-left, 0px)); padding-right: max(26px, env(safe-area-inset-right, 0px)); display: flex; flex-direction: column; gap: 28px; box-shadow: -1px 0 0 var(--line); }
.eyebrow { color: var(--muted); }
h1 { font: 700 46px/.95 var(--display); letter-spacing: -0.035em; margin: 12px 0 0; text-wrap: balance; }
.addr { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.addr p { margin: 0; font-size: 17px; line-height: 1.35; letter-spacing: -0.01em; }
.addr small { display: block; color: var(--muted); font: 500 11px/1.2 var(--mono); letter-spacing: .14em; text-transform: uppercase; margin-top: 8px; }
.copy { flex: none; font: 500 11px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; color: var(--ink); background: var(--secondary); border: 0; border-radius: var(--radius); padding: 9px 11px; cursor: pointer; transition: color 200ms var(--ease); }
.copy:hover { color: var(--accent); }
.dirs { display: grid; gap: 10px; }
.dirs > .label { color: var(--muted); }
.go-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.go { display: flex; justify-content: space-between; align-items: center; padding: 15px 16px; border-radius: var(--radius); background: var(--ink); color: var(--bg); text-decoration: none; font: 700 12px/1 var(--mono); letter-spacing: .14em; text-transform: uppercase; transition: background 200ms var(--ease); }
.go:hover { background: var(--accent); }
.go span { font-weight: 500; letter-spacing: .04em; text-transform: none; opacity: .75; }

h2 { color: var(--muted); margin: 0 0 14px; font-weight: 500; }
ol.steps { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; counter-reset: s; }
ol.steps li { display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 8px; counter-increment: s; cursor: pointer; }
ol.steps li::before { content: counter(s, decimal-leading-zero); font: 500 11px/1 var(--mono); letter-spacing: .08em; color: var(--muted); padding-top: 5px; }
ol.steps li:hover p strong, ol.steps li:focus-visible p strong { color: var(--accent); }
ol.steps li:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: var(--radius); }
ol.steps p { margin: 0; color: var(--muted); font-size: 14px; }
ol.steps p strong { color: var(--ink); font-weight: 700; letter-spacing: -0.015em; display: block; font-size: 16px; margin-bottom: 2px; transition: color 200ms var(--ease); }
.dist { font: 500 12px var(--mono); color: var(--muted); font-variant-numeric: tabular-nums; }

.key { display: grid; gap: 11px; margin: 0; padding: 0; list-style: none; }
.key li { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 10px; font-size: 14px; }
.sw { width: 22px; height: 22px; display: grid; place-items: center; }
.sw.route { height: 4px; background: var(--gl-accent); }
.sw.p { border: 1.5px solid var(--ink); border-radius: var(--radius); font: 700 13px/1 var(--display); }
/* no parking: a plain red stall, in the site's red */
.sw.no { width: 18px; height: 14px; margin-left: 2px; border: 1.5px solid var(--danger); background: color-mix(in oklab, var(--danger) 30%, transparent); }
.sw.rail { height: 8px; border-top: 2px solid var(--muted); border-bottom: 2px solid var(--muted); }
.sw.door { background: var(--gl-accent); width: 12px; height: 12px; transform: rotate(45deg); margin-left: 5px; }
.note { font-size: 13.5px; color: var(--muted); background: var(--secondary); border-radius: var(--radius); padding: 12px 14px; margin: 0; }
.note b { color: var(--ink); font-weight: 700; }
footer { margin-top: auto; font: 500 10px/1.6 var(--mono); letter-spacing: .06em; color: var(--muted); }

@media (max-width: 820px) {
  html, body { height: auto; }
  .app { display: block; height: auto; }
  .stage { height: 64vh; min-height: 380px; }
  aside { box-shadow: 0 -1px 0 var(--line); overflow: visible; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  h1 { font-size: 40px; }
  .hint { display: none; }
}

@font-face { font-family: "Inter Tight"; src: url("/visit/fonts/InterTight-Variable.woff2") format("woff2"); font-weight: 500 900; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("/visit/fonts/IBMPlexMono-400.woff2") format("woff2"); font-weight: 400; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("/visit/fonts/IBMPlexMono-500.woff2") format("woff2"); font-weight: 500; font-display: swap; }
@font-face { font-family: "IBM Plex Mono"; src: url("/visit/fonts/IBMPlexMono-700.woff2") format("woff2"); font-weight: 700; font-display: swap; }
:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
body { margin: 0; }
a.eyebrow { color: var(--muted); text-decoration: none; transition: color 200ms var(--ease); }
a.eyebrow:hover { color: var(--accent); }
a.eyebrow:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
[hidden] { display: none !important; }
</style>
</head>
<body>
<div class="app">
  <div class="stage" id="stage">
    <canvas id="gl" aria-label="3D map of the route from Masonic Drive to the studio entrance at Latitude 37"></canvas>
    <div class="labels" id="labels"></div>
    <div class="compass" aria-hidden="true"><span id="needle"><i></i>N</span></div>
    <div class="hud" role="group" aria-label="Map view">
      <button id="v-overview" aria-pressed="true">Overview</button>
      <button id="v-drive" aria-pressed="false">Drive the route</button>
      <button id="v-top" aria-pressed="false">From above</button>
    </div>
    <div class="hint">Drag to turn<br>Scroll or pinch to zoom</div>
  </div>

  <aside>
    <header>
      <a class="eyebrow label" href="/">Julian Gigola Studio</a>
      <h1>Getting to the studio</h1>
    </header>

    <div class="addr">
      <p id="addr-text">1277 Babb Ct, #520<br>San Jose, CA 95125<small>Latitude 37, 5th floor</small></p>
      <button class="copy" id="copy" type="button">Copy</button>
    </div>

    <div class="dirs">
      <span class="label">Directions</span>
      <div class="go-row">
        <a class="go" id="go" href="#" target="_blank" rel="noopener">Google Maps <span>↗</span></a>
        <a class="go" id="go-apple" href="#" target="_blank" rel="noopener">Apple Maps <span>↗</span></a>
      </div>
    </div>

    <section>
      <h2 class="label">The way in</h2>
      <ol class="steps">
        <li tabindex="0" data-view="curtner"><p><strong>Turn onto Canoas Garden Ave from Curtner Ave</strong>The corner is just west of the Curtner light rail station and Hwy 87.</p></li>
        <li tabindex="0" data-view="masonic"><p><strong>Turn right onto Masonic Dr</strong>After about <span class="dist">280 m</span>, at the Cathedral of Faith campus.</p></li>
        <li tabindex="0" data-view="turn"><p><strong>Turn right onto Babb Ct</strong>After about <span class="dist">160 m</span>, Babb Ct is the private drive into Latitude 37.</p></li>
        <li tabindex="0" data-view="park"><p><strong>Park in a P spot</strong>Any unmarked spot with no number is fine too. Numbered spots belong to residents, and the red spots are off limits.</p></li>
        <li tabindex="0" data-view="door"><p><strong>Walk to the entrance</strong>It's on the right side of the drive, near the far end. Then head up to #520 on the 5th floor.</p></li>
      </ol>
    </section>

    <section>
      <h2 class="label">On the map</h2>
      <ul class="key">
        <li><span class="sw route"></span>Driving route<span></span></li>
        <li><span class="sw p">P</span>East bend, as you enter<span class="dist">~130 m walk</span></li>
        <li><span class="sw p">P</span>Inner drive, by the entrance<span class="dist">~60 m walk</span></li>
        <li><span class="sw p">P</span>West curb, end of the drive<span class="dist">~130 m walk</span></li>
        <li><span class="sw no"></span>No parking for visitors<span></span></li>
        <li><span class="sw door"></span>Studio entrance<span></span></li>
        <li><span class="sw rail"></span>Curtner light rail station<span></span></li>
      </ul>
    </section>

    <p class="note">Some GPS apps list this complex as <b>1255 Babb Ct</b>. Both addresses are the same place. Follow the map once you reach Curtner Ave.</p>

    <footer>Building outlines and streets © OpenStreetMap contributors. Walking distances are approximate.</footer>
  </aside>
</div>
<script src="/visit/vendor/three.min.js"></script>
<script src="/visit/vendor/OrbitControls.js"></script>
<script src="/visit/map.js"></script>
</body>
</html>
`;

export function GET() {
  return new Response(HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
