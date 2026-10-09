import { expect, test } from "@playwright/test";
import { skipSplash } from "./helpers";
import { contextFor, PAGES, VIEWPORTS } from "./matrix";

/**
 * Layout sanity on every page at every size: the page never scrolls
 * sideways as a document, and nothing a visitor reads or presses is cut
 * off by the edge of the screen.
 *
 * "Cut off" means part on and part off the screen with no way to reach
 * the rest. Content inside a box that scrolls (the strips) is reachable
 * and does not count; content inside a box that clips is judged by what
 * of it the box leaves showing. Something wholly off the screen (a closed
 * drawer) is not cut off.
 */

/* Runs in the page. One line per element cut off, at most 12. */
function cutOff(): string[] {
  const W = innerWidth;
  const H = innerHeight;
  const root = document.scrollingElement ?? document.documentElement;
  const docScrollsY = root.scrollHeight > H + 1;
  const content =
    "a, button, input, select, textarea, label, img, video, svg, h1, h2, h3, h4, h5, h6, p, li";
  const out: string[] = [];
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
    if (out.length >= 12) break;
    const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent!.trim());
    if (!own && !el.matches(content)) continue;
    if (el.closest('[aria-hidden="true"], [inert], svg *')) continue;
    /* Text is judged by the letters, not the box: a link's padding may
       run past the edge while every letter shows. */
    const box = el.getBoundingClientRect();
    // Visually hidden (`sr-only`) text is a 1px box.
    if (box.width < 2 || box.height < 2) continue;
    let r: { left: number; right: number; top: number; bottom: number } = box;
    if (own) {
      r = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType !== 3 || !n.textContent!.trim()) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const t = range.getBoundingClientRect();
        r = {
          left: Math.min(r.left, t.left),
          right: Math.max(r.right, t.right),
          top: Math.min(r.top, t.top),
          bottom: Math.max(r.bottom, t.bottom),
        };
      }
    }
    if (r.right - r.left < 2 || r.bottom - r.top < 2) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;

    /* Walk up: a scroller on an axis makes that axis reachable, a clipping
       box trims what shows. */
    let x = { lo: r.left, hi: r.right, reach: false };
    let y = { lo: r.top, hi: r.bottom, reach: docScrollsY && cs.position !== "fixed" };
    let hidden = false;
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const s = getComputedStyle(a);
      if (s.opacity === "0" || s.visibility === "hidden") hidden = true;
      const box = a.getBoundingClientRect();
      const clips = (o: string) => o !== "visible";
      const scrolls = (o: string) => o === "auto" || o === "scroll";
      const paint = s.contain.includes("paint") || s.contain === "strict" || s.contain === "content";
      if (scrolls(s.overflowX)) x.reach = true;
      else if (clips(s.overflowX) || paint) x = { lo: Math.max(x.lo, box.left), hi: Math.min(x.hi, box.right), reach: x.reach };
      if (scrolls(s.overflowY)) y.reach = true;
      else if (clips(s.overflowY) || paint) y = { lo: Math.max(y.lo, box.top), hi: Math.min(y.hi, box.bottom), reach: y.reach };
    }
    if (hidden || x.hi - x.lo < 2 || y.hi - y.lo < 2) continue;
    const straddles = (a: { lo: number; hi: number }, max: number) =>
      (a.lo < -1 && a.hi > 1) || (a.hi > max + 1 && a.lo < max - 1);
    const bad = (!x.reach && straddles(x, W)) || (!y.reach && straddles(y, H));
    if (!bad) continue;
    const name =
      el.tagName.toLowerCase() +
      (el.id ? `#${el.id}` : "") +
      (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
    out.push(`${name} [${Math.round(r.left)},${Math.round(r.top)} to ${Math.round(r.right)},${Math.round(r.bottom)}] "${text}"`);
  }
  return out;
}

for (const path of PAGES) {
  test.describe(`layout ${path}`, () => {
    for (const v of VIEWPORTS) {
      test(`${v.name}`, async ({ browser, browserName }) => {
        const ctx = await browser.newContext(contextFor(v, browserName));
        try {
          await skipSplash(ctx);
          const page = await ctx.newPage();
          const res = await page.goto(path, { waitUntil: "load" });
          expect(res?.ok(), `${path} answers`).toBe(true);
          // The entrance runs about a second; judge the page at rest.
          await page.waitForTimeout(1800);

          /* Polled, so a page still settling under a loaded machine gets a
             few more seconds. What is still wrong after that is a fault. */
          await expect
            .poll(
              () =>
                page.evaluate(() => {
                  const doc = document.documentElement.scrollWidth;
                  const body = document.body.scrollWidth;
                  /* A page that is one window clips at the root
                     (`html:has([data-quiet-footer])`), and what runs past it
                     there is judged by `cutOff`, not by the body's width. */
                  const clips = getComputedStyle(document.documentElement).overflowX !== "visible";
                  const out: string[] = [];
                  if (doc > innerWidth + 1) out.push(`the page scrolls sideways: ${doc} wide on ${innerWidth}`);
                  if (!clips && body > innerWidth + 1) out.push(`the body is ${body} wide on ${innerWidth}`);
                  return out;
                }),
              { message: "no sideways overflow", timeout: 5000 },
            )
            .toEqual([]);
          await expect.poll(() => page.evaluate(cutOff), { message: "nothing cut off by the screen's edge", timeout: 5000 }).toEqual([]);
        } finally {
          await ctx.close();
        }
      });
    }
  });
}
