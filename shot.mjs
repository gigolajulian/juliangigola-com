import { chromium } from "file:///C:/Users/Julian/Documents/Claude/Projects/JG%20WEBSITE%20NEW/node_modules/playwright/index.mjs";
const b = await chromium.launch();
const out = process.env.TMPDIR;
for (const theme of ["light","dark"]) {
  const c = await b.newContext({ viewport:{width:1440,height:900}, colorScheme: theme });
  const p = await c.newPage();
  for (const [name,url] of [["work","http://localhost:3999/work/video"],["contact","http://localhost:3999/contact"],["studio","http://localhost:3999/studio"]]) {
    try {
      await p.goto(url,{waitUntil:"networkidle",timeout:45000});
      await p.waitForTimeout(1500);
      await p.screenshot({path:`${out}/${name}-${theme}.png`});
      if(name==="work"){
        const d = await p.evaluate(()=>({reel:document.documentElement.dataset.reel??null,
          fg:getComputedStyle(document.body).color,
          src:document.querySelector(".reel-backdrop-frame")?.getAttribute("src")??null}));
        console.log(theme, JSON.stringify(d));
      }
      if(name==="contact"){
        const d = await p.evaluate(()=>({vimeo:/vimeo/i.test(document.body.innerText),
          replies:/replies/i.test(document.body.innerText),
          tick:document.querySelector('[title]')?null:null}));
        console.log("contact",theme,JSON.stringify(d));
      }
      if(name==="studio") console.log("studio",theme,JSON.stringify({vision:/vision/i.test(document.body.innerText)}));
    } catch(e){ console.log("FAIL",name,theme,e.message.slice(0,80)); }
  }
  await c.close();
}
await b.close();
