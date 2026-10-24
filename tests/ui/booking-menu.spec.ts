import { expect, test } from "@playwright/test";
import { CONFIRM, errorsOn, open, RATIOS, upright } from "./ratios";

/* The homepage's Sessions index (JG V3, `components/v3/home.tsx`): each row
   opens its session's booking page (`/book/<slug>`). Never submitted. */

for (const r of RATIOS) {
  test(`sessions index at ${r.name}`, async ({ browser, browserName }) => {
    const { ctx, page } = await open(browser, browserName, r);
    const errors = errorsOn(page);
    await page.goto("/#sessions", { waitUntil: "load" });
    if (await upright(page, r, browserName)) return ctx.close();
    const rows = page.locator("#sessions .row");
    await rows.first().scrollIntoViewIfNeeded();
    // Portraits, Graduation, Headshots, Studio digitals, Weddings.
    expect(await rows.count()).toBe(5);
    const portraits = rows.filter({ hasText: /Portraits/i }).first();
    await (r.touch ? portraits.tap() : portraits.click());
    await page.waitForURL(/\/book\/portraits$/);
    await page.locator("[data-day]").first().waitFor({ state: "visible", timeout: 30_000 });
    await expect(page.getByRole("button", { name: CONFIRM })).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sideways scroll").toBe(true);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test("keyboard: a row takes focus and Enter opens its session", async ({ browser, browserName }) => {
  const { ctx, page } = await open(browser, browserName, RATIOS[4]);
  await page.goto("/#sessions", { waitUntil: "load" });
  const row = page.locator("#sessions .row").filter({ hasText: /Portraits/i }).first();
  await row.focus();
  expect(await row.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/book\/portraits$/);
  await ctx.close();
});
