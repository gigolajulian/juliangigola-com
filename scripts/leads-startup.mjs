/* Renders the Leads app's icons and startup screens from public/leads-app/icon-glass.svg
 * (the square web version of the desktop app's glass tile; the icon is paths only, no font).
 * Icons: 192, 512, the maskable 512 (the JG already sits inside the safe zone) and the
 * 180 apple-touch. Startup screens (lib/leads/leads-startup.ts): black, the icon centered.
 * Run: node scripts/leads-startup.mjs */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { STARTUP_SCREENS } from "../lib/leads/leads-startup.ts";

const svg = readFileSync("public/leads-app/icon-glass.svg", "utf8").replace(/<svg ([^>]*?)width="512" height="512"/, '<svg $1width="100%" height="100%"');
const b = await chromium.launch();
const shot = async (w, h, r, body, path) => {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: r });
  await p.setContent(`<!doctype html><style>html,body{margin:0;height:100%;background:#000;display:grid;place-items:center}</style>${body}`);
  await p.screenshot({ path });
  await p.close();
};
for (const [file, n] of [["icon-192", 192], ["icon-512", 512], ["icon-maskable-512", 512], ["apple-touch-icon", 180]])
  await shot(n, n, 1, `<div style="width:100%;height:100%">${svg}</div>`, `public/leads-app/${file}.png`);
for (const [w, h, r] of STARTUP_SCREENS) {
  const tile = Math.min(128, Math.round(Math.min(w, h) * 0.26));
  await shot(w, h, r, `<div style="width:${tile}px;height:${tile}px;border-radius:${Math.round(tile * 0.225)}px;overflow:hidden">${svg}</div>`, `public/leads-app/startup/${w * r}x${h * r}.png`);
}
await b.close();
