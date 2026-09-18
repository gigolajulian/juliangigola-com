import { chromium } from "file:///C:/Users/Julian/Documents/Claude/Projects/JG%20WEBSITE%20NEW/node_modules/playwright/index.mjs";
const b = await chromium.launch(); const out = process.env.TMPDIR;
for (const theme of ["light","dark"]) {
  const c = await b.newContext({viewport:{width:1440,height:900},colorScheme:theme});
  const p = await c.newPage();
  await p.goto("http://localhost:3999/work/video",{waitUntil:"domcontentloaded",timeout:60000});
  await p.waitForTimeout(4000);
  await p.screenshot({path:`${out}/motion-${theme}.png`});
  console.log("motion",theme,JSON.stringify(await p.evaluate(()=>({
    reel:document.documentElement.dataset.reel??null,
    bodyColor:getComputedStyle(document.body).color,
    src:document.querySelector(".reel-backdrop-frame")?.getAttribute("src")??null}))));
  await p.goto("http://localhost:3999/studio",{waitUntil:"domcontentloaded",timeout:60000});
  await p.waitForTimeout(2500);
  await p.screenshot({path:`${out}/studio-${theme}.png`});
  console.log("studio",theme,JSON.stringify(await p.evaluate(()=>({vision:/vision/i.test(document.body.innerText)}))));
  await c.close();
}
await b.close();
