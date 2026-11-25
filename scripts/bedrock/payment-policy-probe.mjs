import http from "node:http";
import { chromium } from "playwright";
const pol = process.argv[2];
const srv = http.createServer((q, r) => {
  if (q.url.startsWith("/frame")) { r.writeHead(200, {"content-type":"text/html"}); r.end("<script>parent.postMessage({inFrame: document.featurePolicy.allowsFeature('payment')}, '*')</script>"); return; }
  r.writeHead(200, {"content-type":"text/html", "permissions-policy": pol});
  r.end(`<iframe allow="payment" src="http://127.0.0.1:${srv.address().port === 0 ? 0 : 0}"></iframe>`);
}).listen(0, "127.0.0.1");
await new Promise(r => srv.on("listening", r));
const port = srv.address().port;
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(`http://127.0.0.1:${port}/`);
const top = await p.evaluate(() => document.featurePolicy.allowsFeature("payment"));
// a cross-origin frame (localhost vs 127.0.0.1) with allow="payment", as Stripe's iframe is mounted
const inFrame = await p.evaluate((port) => new Promise(res => { addEventListener("message", e => res(e.data.inFrame)); const f = document.createElement("iframe"); f.allow = "payment"; f.src = `http://localhost:${port}/frame`; document.body.append(f); }), port);
console.log(JSON.stringify({ policy: pol, top, crossOriginFrame: inFrame }));
await b.close(); srv.close();
