import { expect, test } from "@playwright/test";
import { CONFIRM, errorsOn, open, RATIOS, upright } from "./ratios";

/* The homepage's Sessions (V4, `components/v3/mt/book-online.tsx`): a row opens
   its session's booking card in place, "All sessions" goes to /book. The old
   links land here too (/sessions 308s to /#sessions). Never submitted. */

for (const r of RATIOS) {
  test(`sessions at ${r.name}`, async ({ browser, browserName }) => {
    const { ctx, page } = await open(browser, browserName, r);
    const errors = errorsOn(page);
    await page.goto("/#sessions", { waitUntil: "load" });
    if (await upright(page, r, browserName)) return ctx.close();
    const sec = page.locator("#sessions");
    const rows = sec.locator(".mt-br");
    // Portraits, Headshots, Graduation, Studio digitals.
    await expect(rows).toHaveCount(4);
    // the anchor lands on the block: its top is on screen, under the header at most
    await expect.poll(() => sec.evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBeLessThan(80);
    expect(await sec.evaluate((e) => Math.round(e.getBoundingClientRect().top))).toBeGreaterThan(-2);
    const portraits = rows.filter({ hasText: /Portraits/i }).first();
    // a finger picks a row first, then books it: Portraits is the row already picked, so one tap books
    await (r.touch ? portraits.tap() : portraits.click());
    await expect(sec).toHaveAttribute("data-open", "");
    await sec.locator("[data-day]").first().waitFor({ state: "visible", timeout: 30_000 });
    await expect(sec.getByRole("button", { name: CONFIRM })).toBeAttached();
    expect(page.url(), "the card opens in place").toMatch(/\/#sessions$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sideways scroll").toBe(true);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test("All sessions goes to /book", async ({ browser, browserName }) => {
  const { ctx, page } = await open(browser, browserName, RATIOS[4]);
  await page.goto("/#sessions", { waitUntil: "load" });
  await page.locator("#sessions a.mt-link").click();
  await page.waitForURL(/\/book$/);
  await ctx.close();
});

test("keyboard: a row takes focus and Enter opens its session", async ({ browser, browserName }) => {
  const { ctx, page } = await open(browser, browserName, RATIOS[4]);
  await page.goto("/#sessions", { waitUntil: "load" });
  const sec = page.locator("#sessions");
  await sec.locator(".mt-br").first().waitFor();
  // Tab from the page, so the focus is a keyboard's (:focus-visible)
  const row = sec.locator(".mt-br").filter({ hasText: /Headshots/i }).first();
  await sec.locator(".mt-br").first().focus();
  await page.keyboard.press("Tab");
  await expect(row).toBeFocused();
  expect(await row.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(sec).toHaveAttribute("data-open", "");
  await expect(sec).toHaveAttribute("data-on", "headshots");
  await ctx.close();
});
