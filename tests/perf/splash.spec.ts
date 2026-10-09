import { expect, test } from "@playwright/test";
import budgets from "./budgets.json";
import { awake, frameStats, report } from "./helpers";
import { contextFor, VIEWPORTS } from "./matrix";

/**
 * The first-visit splash (`components/intro.tsx`): when it lifts, and how
 * its frames go. It is a fixed 3s from the first paint, whatever is still
 * loading, so a lift much later than that means the page held it. The
 * latest it may lift is `splash.liftedMs` in `budgets.json`.
 *
 * Headed: headless WebKit draws this site at a few frames a second.
 */

test.use({ headless: false });

const SPLASH_PAGES = ["/", "/portfolio", "/model-digitals"] as const;

declare global {
  interface Window {
    __splash: { on: number; off: number; frames: number[] };
  }
}

for (const path of SPLASH_PAGES) {
  test.describe(`splash ${path} @motion`, () => {
    for (const v of VIEWPORTS) {
      test(`${v.name}`, async ({ browser, browserName }, info) => {
        const ctx = await browser.newContext(contextFor(v, browserName));
        try {
          /* From the first moment of the document: when `data-intro` is
             set (by the inline script in `layout.tsx`) and when it goes,
             and every frame until then. */
          await ctx.addInitScript(() => {
            const s = (window.__splash = { on: -1, off: -1, frames: [] as number[] });
            const check = () => {
              const intro = document.documentElement?.dataset.intro;
              if (intro === "1" && s.on < 0) s.on = performance.now();
              if (s.on >= 0 && intro === undefined && s.off < 0) s.off = performance.now();
            };
            new MutationObserver(check).observe(document, {
              attributes: true,
              attributeFilter: ["data-intro"],
              subtree: true,
            });
            let last = 0;
            const tick = (t: number) => {
              check();
              if (last && s.off < 0) s.frames.push(t - last);
              last = t;
              if (s.off < 0) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          });
          const page = await ctx.newPage();
          await page.bringToFront();
          await page.goto(path, { waitUntil: "commit" });
          await page
            .waitForFunction(() => window.__splash.off >= 0, null, { timeout: 10_000 })
            .catch(() => {});
          const s = await page.evaluate(() => window.__splash);
          const valid = await awake(page);
          const st = frameStats(s.frames);
          await report(info, {
            kind: "splash",
            page: path,
            viewport: v.name,
            lifted: s.off >= 0 ? Math.round(s.off) : "never",
            ...(valid ? st : { frames: st.frames, median: "throttled", slow: "-", worst: "-" }),
          });
          test.skip(!valid, "window throttled by macOS during the splash");
          expect(s.on, "the splash showed").toBeGreaterThanOrEqual(0);
          expect(s.off, "the splash lifted").toBeGreaterThanOrEqual(0);
          expect(s.off, `lifted by ${budgets.splash.liftedMs}ms`).toBeLessThanOrEqual(budgets.splash.liftedMs);
        } finally {
          await ctx.close();
        }
      });
    }
  });
}
