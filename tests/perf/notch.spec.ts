import { expect, test } from "@playwright/test";
import { screens, settle, skipSplash } from "./helpers";
import { contextFor, VIEWPORTS } from "./matrix";

/**
 * A mouse wheel on the homepage, at every desktop size: one notch lands
 * exactly one screen on, and one back lands one screen back. Both kinds of
 * notch: pixels (Chrome, Safari, Edge) and lines (Firefox's mouse).
 *
 * A notch carries a set distance, and a paged strip turns once it has come
 * far enough. Measured that way it was a fifth of a screen, which a notch
 * falls short of from about 1800px wide: on a 1920 monitor the homepage
 * would not turn for a mouse at all.
 *
 * The notches are dispatched as wheel events on the middle of the strip,
 * the same way for every browser: Playwright's own wheel arrives in
 * pixels everywhere, and divided by the pixel ratio in Firefox.
 */

const NOTCHES = [
  { kind: "pixels", deltaY: 100, deltaMode: 0 },
  { kind: "lines", deltaY: 3, deltaMode: 1 },
] as const;
const PLAN = [1, 1, -1] as const;

for (const v of VIEWPORTS.filter((v) => !v.touch)) {
  for (const n of NOTCHES) {
    test(`notch ${n.kind} / ${v.name}`, async ({ browser, browserName }) => {
      const ctx = await browser.newContext(contextFor(v, browserName));
      try {
        await skipSplash(ctx);
        const page = await ctx.newPage();
        await page.goto("/", { waitUntil: "load" });
        await page.waitForTimeout(2500);
        const misses: string[] = [];
        for (const sign of PLAN) {
          const before = await screens(page);
          const from = await page.evaluate(() => document.querySelector(".strip-scroll")!.scrollLeft);
          await page.evaluate(
            ({ deltaY, deltaMode }) => {
              const el = document.querySelector(".strip-scroll")!;
              const r = el.getBoundingClientRect();
              const x = r.left + r.width / 2;
              const y = r.top + r.height / 2;
              (document.elementFromPoint(x, y) ?? el).dispatchEvent(
                new WheelEvent("wheel", { deltaY, deltaMode, clientX: x, clientY: y, bubbles: true, cancelable: true }),
              );
            },
            { deltaY: n.deltaY * sign, deltaMode: n.deltaMode },
          );
          const to = await settle(page);
          const next =
            sign > 0
              ? Math.min(before.max, ...before.at.filter((a) => a > from + 1))
              : Math.max(0, ...before.at.filter((a) => a < from - 1));
          if (Math.abs(to - next) > 2) misses.push(`${sign > 0 ? "on" : "back"} from ${Math.round(from)}: ${Math.round(to)}, not ${Math.round(next)}`);
        }
        expect(misses, "each notch lands exactly one screen").toEqual([]);
      } finally {
        await ctx.close();
      }
    });
  }
}
