import { expect, test, type Page } from "@playwright/test";
import { CONFIRM, errorsOn, open, RATIOS, upright } from "./ratios";

/* The homepage's Sessions screen with its booking card, the default since 2026-10-13
   (`sessions-screen.tsx`, `BookCard` in `book-here.tsx`). Never submitted. */

const menu = async (page: Page, flag = "") => {
  await page.goto(`/${flag}#sessions`, { waitUntil: "load" });
  const sec = page.locator('section[data-hash="sessions"]');
  await sec.waitFor();
  await sec.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(2000);
  return sec;
};
const row = (page: Page, name: RegExp) =>
  page.locator('section[data-hash="sessions"] .session-list > li > button').filter({ hasText: name }).first();

for (const r of RATIOS) {
  test(`booking menu at ${r.name}`, async ({ browser, browserName }) => {
    const { ctx, page } = await open(browser, browserName, r);
    const errors = errorsOn(page);
    const sec = await menu(page);
    if (await upright(page, r, browserName)) return ctx.close();
    // The four sessions and the wedding call; commissions go through Inquire (two doors).
    expect(await sec.locator(".session-list > li").count()).toBe(5);
    /* A finger, where the ratio is a touch screen. Firefox cannot emulate a
       phone and keeps a hovering mouse there: a hovered row opens its line
       and moves the rows round it by up to ~225px, so a mouse click on
       Event coverage landed on whichever row slid under it (Headshots, in
       CI's flaky runs). A tap has no hover. */
    const press = (l: ReturnType<typeof row>) => (r.touch ? l.tap() : l.click());

    // A session opens its card, with the calendar.
    const card = page.locator("#book-card");
    await press(row(page, /Portraits/i));
    await card.locator("[data-day]").first().waitFor({ state: "visible", timeout: 30_000 });
    await expect(card).toHaveAttribute("aria-label", /Portraits/);
    await expect(card.getByRole("button", { name: CONFIRM })).toBeAttached();

    // Close sits clear of the calendar, whatever it scrolls to. Polled: the
    // card is still settling for a moment on a slow CI runner.
    const isClear = () => card.evaluate((c) => {
      const close = [...c.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Close")!;
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
    await expect.poll(isClear, { message: "nothing drawn over Close", timeout: 10_000 }).toBe(true);

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
  expect(await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))).toBe("Close");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => document.activeElement?.textContent?.replace(/\s+/g, ""))).toMatch(/Portraits/i);
  await ctx.close();
});

