import { expect, test } from "@playwright/test";
import { open, RATIOS } from "./ratios";

/* The booking pages (/portraits, /weddings...): the deck ends at Book and
   stays there, and the page's own picker lets a time be confirmed. */

for (const r of RATIOS.filter((x) => !x.touch)) {
  test(`/portraits stays on Book past the last screen at ${r.name}`, async ({ browser, browserName }) => {
    const { ctx, page } = await open(browser, browserName, r);
    await page.goto("/portraits", { waitUntil: "load" });
    await page.waitForTimeout(2500);
    await page.mouse.move(r.width / 2, r.height / 2);
    for (let i = 0; i < 14; i++) {
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(800);
    }
    await page.waitForTimeout(2000);
    const on = await page.evaluate(() => {
      const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      const secs = [...document.querySelectorAll<HTMLElement>("section[data-label]")];
      return { path: location.pathname, on: hit?.closest<HTMLElement>("section[data-label]")?.dataset.label, last: secs.at(-1)?.dataset.label };
    });
    expect(on.path).toBe("/portraits");
    expect(on.on).toBe(on.last);
    await ctx.close();
  });
}

for (const slug of ["portraits", "music-photography"]) {
  for (const r of [RATIOS[0], RATIOS[4]]) {
    test(`/${slug}#book: a time can be confirmed at ${r.name}`, async ({ browser, browserName }) => {
      const { ctx, page } = await open(browser, browserName, r);
      await page.goto(`/${slug}#book`, { waitUntil: "load" });
      const region = page.locator("[role=region].tp");
      await region.scrollIntoViewIfNeeded({ timeout: 30_000 });
      await page.locator("[data-day]").first().waitFor({ timeout: 30_000 });
      await page.locator("[data-day]:not([disabled]):visible").first().click();
      // The card may scroll inside: take it to its end, as a person would.
      await region.evaluate((e) => {
        let c = e.parentElement;
        while (c && getComputedStyle(c).overflowY === "visible") c = c.parentElement;
        if (c && c !== document.documentElement && c !== document.body) c.scrollTop = c.scrollHeight;
      });
      await page.waitForTimeout(300);
      await page.locator("[data-slot]:not([disabled]):visible").last().click();
      const confirm = page.getByRole("button", { name: "Confirm this time" });
      await expect(confirm).toBeEnabled();
      await confirm.scrollIntoViewIfNeeded();
      const reach = await confirm.evaluate((b) => {
        const q = b.getBoundingClientRect();
        const hit = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
        return { inView: q.top >= 0 && q.bottom <= innerHeight + 1, onTop: !!hit && (hit === b || b.contains(hit)) };
      });
      expect(reach).toEqual({ inView: true, onTop: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sideways scroll").toBe(true);
      await ctx.close();
    });
  }
}
