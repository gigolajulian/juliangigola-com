import { expect, test } from "@playwright/test";
import budgets from "./budgets.json";
import { report, skipSplash } from "./helpers";
import { contextFor, PAGES, VIEWPORTS } from "./matrix";

/**
 * Image weight on the first screen: every image byte a page downloads
 * before a visitor has moved, per page and per screen size, against a
 * budget in `budgets.json`. That includes the pictures a strip warms for
 * the screens after the first, which a visitor pays for all the same.
 *
 * The budgets are the measured weight plus 15%, and never under 32KB, so
 * a page with no photographs can still take an icon. A page that goes
 * over has started fetching more, or bigger, pictures up front than it
 * did; raise the number only when that was the intent.
 *
 * Measured on a local build (`JG_LOCAL=1`), whose photographs come from
 * the live zone at production sizes and formats.
 */

const IMAGE_BUDGETS = budgets.images as Record<string, Record<string, number>>;

for (const path of PAGES) {
  test.describe(`images ${path}`, () => {
    for (const v of VIEWPORTS) {
      test(`${v.name}`, async ({ browser, browserName }, info) => {
        const ctx = await browser.newContext(contextFor(v, browserName));
        try {
          await skipSplash(ctx);
          const page = await ctx.newPage();
          const pending: Promise<number>[] = [];
          let lastImage = Date.now();
          page.on("response", (res) => {
            const type = res.headers()["content-type"] ?? "";
            if (res.request().resourceType() !== "image" && !type.startsWith("image/")) return;
            if (res.status() >= 300) return;
            lastImage = Date.now();
            pending.push(res.body().then((b) => b.length, () => 0));
          });
          await page.goto(path, { waitUntil: "load" });
          /* The strips warm the next screens' pictures once the page is in
             (`strip.tsx`), after `load`. Done when no image has arrived
             for 2.5s, or after 20s. */
          const t0 = Date.now();
          while (Date.now() - lastImage < 2500 && Date.now() - t0 < 20_000) {
            await page.waitForTimeout(250);
          }
          const bytes = (await Promise.all(pending)).reduce((a, b) => a + b, 0);
          const kb = Math.round(bytes / 1024);
          const budget = IMAGE_BUDGETS[path]?.[v.name];
          await report(info, {
            kind: "images",
            page: path,
            viewport: v.name,
            count: pending.length,
            kb,
            budget: budget ?? "-",
          });
          expect(budget, `a budget for ${path} at ${v.name} in budgets.json`).toBeDefined();
          expect(kb, `first-screen image KB on ${path} at ${v.name}`).toBeLessThanOrEqual(budget!);
        } finally {
          await ctx.close();
        }
      });
    }
  });
}
