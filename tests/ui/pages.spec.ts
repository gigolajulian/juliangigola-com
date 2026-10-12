import { expect, test } from "@playwright/test";
import { BOOKING_SLUGS } from "@/lib/booking-slugs";
import { errorsOn, open, RATIOS } from "./ratios";

/* Every page a visitor lands on, at the six ratios: it answers 200, runs
   without a script error, and puts a heading on screen. Layout and image
   weight are the perf suite's static half (`tests/perf`), which the
   frontend suite runs as well. */

const PAGES = ["/", "/portfolio", "/portfolio/editorial", "/portfolio/nova", "/book", "/legal", ...BOOKING_SLUGS.map((s) => `/${s}`)];

for (const r of RATIOS) {
  test.describe(r.name, () => {
    for (const path of PAGES) {
      test(`${path} loads clean`, async ({ browser, browserName }) => {
        const { ctx, page } = await open(browser, browserName, r);
        const errors = errorsOn(page);
        const res = await page.goto(path, { waitUntil: "load" });
        expect(res?.status(), "status").toBe(200);
        await expect(page.locator("h1, h2").first()).toBeAttached();
        await page.waitForTimeout(1500);
        expect(errors).toEqual([]);
        await ctx.close();
      });
    }
  });
}

test("an unknown address answers 404 with the site's own page", async ({ page }) => {
  const res = await page.goto("/no-such-page-qa", { waitUntil: "load" });
  expect(res?.status()).toBe(404);
  await expect(page.locator("body")).toContainText(/./);
});
