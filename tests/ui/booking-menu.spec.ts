import { expect, test, type Page } from "@playwright/test";
import { errorsOn, open, RATIOS, upright } from "./ratios";

/* The homepage's Sessions screen as a booking menu, behind `?bookhere`
   (`components/book-here.tsx`). Without the flag the screen is the plain
   Sessions list. Never submitted. */

const menu = async (page: Page, flag = "?bookhere") => {
  await page.goto(`/${flag}#sessions`, { waitUntil: "load" });
  const sec = page.locator('section[data-hash="sessions"]');
  await sec.waitFor();
  await sec.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(2000);
  return sec;
};
const row = (page: Page, name: RegExp) =>
  page.locator('section[data-hash="sessions"] li[data-i] button').filter({ hasText: name }).first();

for (const r of RATIOS) {
  test(`booking menu at ${r.name}`, async ({ browser, browserName }) => {
    const { ctx, page } = await open(browser, browserName, r);
    const errors = errorsOn(page);
    const sec = await menu(page);
    if (await upright(page, r, browserName)) return ctx.close();
    const items = await sec.locator("li[data-i]").evaluateAll((ns) => ns.map((n) => {
      const q = n.getBoundingClientRect();
      return { x: Math.round(q.x), h: (n.querySelector("button") as HTMLElement).getBoundingClientRect().height };
    }));
    expect(items.length).toBeGreaterThanOrEqual(8);
    if (r.name === "ipad") expect(new Set(items.map((i) => i.x)).size, "two columns on a portrait tablet").toBeGreaterThanOrEqual(2);
    // 44px rows are the phone's (`max-sm` in book-here.tsx). A tablet's are smaller by design for now.
    if (r.width < 640) expect(Math.min(...items.map((i) => i.h)), "rows a finger can hit").toBeGreaterThanOrEqual(44);

    // A session turns the photograph into its calendar.
    const card = page.locator("#book-card");
    await row(page, /Portraits/i).click();
    await card.locator("[data-day]").first().waitFor({ state: "visible", timeout: 30_000 });
    await expect(card).toHaveAttribute("aria-label", /Portraits/);
    await expect(card.getByRole("button", { name: "Confirm this time" })).toBeAttached();

    // Close sits clear of the calendar, whatever it scrolls to.
    const clear = await card.evaluate((c) => {
      const close = [...c.querySelectorAll("button")].find((b) => /^Close/.test(b.textContent!.trim()))!;
      const sc = [...c.querySelectorAll<HTMLElement>("*")].find((n) => /(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 1);
      const cb = close.getBoundingClientRect();
      if (!sc) return true;
      const ok = [0, 0.5, 1].every((f) => {
        sc.scrollTop = (sc.scrollHeight - sc.clientHeight) * f;
        const hit = document.elementFromPoint(cb.left + cb.width / 2, cb.top + cb.height / 2);
        return !!hit && (hit === close || close.contains(hit));
      });
      sc.scrollTop = 0;
      return ok;
    });
    expect(clear, "nothing drawn over Close").toBe(true);

    // A commission opens the form, Inquire on screen without scrolling.
    await card.getByRole("button", { name: /close/i }).click();
    await page.waitForTimeout(1200);
    await row(page, /Event coverage/i).scrollIntoViewIfNeeded();
    await row(page, /Event coverage/i).click();
    await expect(card.locator('input[name="name"]')).toBeVisible({ timeout: 15_000 });
    /* The card animates open; under a loaded machine that runs past a fixed
       wait, so wait until Inquire is the top element, then measure. */
    const measure = () =>
      card.locator('button[type="submit"]').evaluate((b) => {
        const q = b.getBoundingClientRect();
        const hit = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
        return { bottom: q.bottom, top: q.top, onTop: !!hit && (hit === b || b.contains(hit)) };
      });
    await expect.poll(async () => (await measure()).onTop, { timeout: 10_000 }).toBe(true).catch(() => {});
    const send = await measure();
    expect(send.top).toBeGreaterThanOrEqual(0);
    expect(send.bottom, "Inquire on screen").toBeLessThanOrEqual(r.height + 1);
    expect(send.onTop, "Inquire not covered").toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sideways scroll").toBe(true);
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test("keyboard: Enter opens the card with focus in it, Tab reaches Close, Escape returns to the row", async ({ browser, browserName }) => {
  const { ctx, page } = await open(browser, browserName, RATIOS[4]);
  await menu(page);
  await row(page, /Portraits/i).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("book-card");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toMatch(/^Close/);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => document.activeElement?.textContent?.replace(/\s+/g, ""))).toMatch(/Portraits/i);
  await ctx.close();
});

test("without the flag, Sessions stays the plain list", async ({ browser, browserName }) => {
  const { ctx, page } = await open(browser, browserName, RATIOS[4]);
  await menu(page, "");
  await expect(page.locator("#book-card")).toHaveCount(0);
  await expect(page.locator('section[data-hash="sessions"]')).toContainText(/Portraits/i);
  await ctx.close();
});
