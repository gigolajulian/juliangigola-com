/* Renders the Leads app's startup screens (lib/leads-startup.ts) into
 * public/leads-app/startup: black, the B1 icon centered, Inter Tight loaded
 * for its LEADS. Run: node scripts/leads-startup.mjs */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { STARTUP_SCREENS } from "../lib/leads-startup.ts";

const svg = readFileSync("public/leads-app/icon-b1.svg", "utf8").replace("<svg ", '<svg width="100%" height="100%" ');
const font = readFileSync("app/fonts/InterTight-Variable.woff2").toString("base64");
const b = await chromium.launch();
for (const [w, h, r] of STARTUP_SCREENS) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: r });
  const tile = Math.min(128, Math.round(Math.min(w, h) * 0.26));
  await p.setContent(`<!doctype html><style>@font-face{font-family:"Inter Tight";src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900}
html,body{margin:0;height:100%;background:#000;display:grid;place-items:center}
div{width:${tile}px;height:${tile}px;border-radius:${Math.round(tile * 0.225)}px;overflow:hidden}</style><div>${svg}</div>`);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `public/leads-app/startup/${w * r}x${h * r}.png` });
  await p.close();
}
await b.close();
