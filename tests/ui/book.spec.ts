import { expect, test } from "@playwright/test";
import { CONFIRM, errorsOn, open, pickTime, RATIOS, SHORT, upright } from "./ratios";

/* The /book time picker, at the six ratios and the short desktop where
   it draws at 80%. Times come from fixtures (`open`, ratios.ts). Never submitted: the
   form is opened and filled "QA TEST", then Change takes it back. */

for (const r of [...RATIOS, SHORT]) {
  test(`/book picks a time at ${r.name}`, async ({ browser, browserName }) => {
    const { ctx, page } = await open(browser, browserName, r);
    const errors = errorsOn(page);
    await page.goto("/book?session=headshots", { waitUntil: "load" });
    if (await upright(page, r, browserName)) return ctx.close();
    const confirm = page.getByRole("button", { name: CONFIRM });
    await page.locator("[data-day]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);

    // JG V3 (master stepper): it opens on the first open day and time, so
    // Continue is on from the start; a day and a time change the pick.
    await expect(confirm).toBeEnabled();
    await page.locator("[data-day]:not([disabled]):visible").first().click();
    await pickTime(page);
    await expect(confirm).toBeEnabled();
    const picked = await page.locator("[data-slot][aria-pressed=true]").getAttribute("aria-label");

    // The picker never scrolls inside itself, nor the page sideways. The one
    // exception: in a wide editorial card the times run in their own column
    // beside the month and scroll there (2026-10-21), the month never does.
    // The V3 stepper (`.f-main`) or the classic card's region.
    const inner = await page.locator("[role=region].tp, .flow .f-main").first().evaluate((e) =>
      [e, ...e.querySelectorAll("*")].filter((n) => !n.classList.contains("ed-times") && /(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 1).length);
    expect(inner, "picker scrolls inside").toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sideways scroll").toBe(true);

    // Scrolled to the end: Confirm on screen, above the footer, and no time under its bar.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    const c = await confirm.evaluate((b) => {
      const q = b.getBoundingClientRect(), bar = b.parentElement!.getBoundingClientRect();
      const foot = document.querySelector("footer")?.getBoundingClientRect();
      const slots = [...document.querySelectorAll("[data-slot]")].filter((n) => (n as HTMLElement).offsetParent && !n.closest('[aria-hidden="true"]'));
      const last = Math.max(...slots.map((n) => n.getBoundingClientRect().bottom));
      const bp = document.querySelector(".book-page");
      const zoom = bp ? parseFloat(getComputedStyle(bp).zoom) || 1 : 1;
      return { top: q.top, bottom: q.bottom, barTop: bar.top, footTop: foot?.top ?? Infinity, gap: bar.top - last, zoom, ed: !!b.closest(".ed") };
    });
    expect(c.bottom, "Confirm on screen").toBeLessThanOrEqual(r.height + 1);
    expect(c.bottom, "Confirm above the footer").toBeLessThanOrEqual(c.footTop + 1);
    // The 24px under the times is the classic card's bar; the editorial card has its own floor.
    if (!c.ed) expect(c.gap, "last time clear of the Confirm bar").toBeGreaterThanOrEqual(Math.floor(24 * c.zoom) - 0.5);

    // The form opens after Confirm's orbs, and Change keeps the pick.
    await confirm.click();
    const name = page.locator('input[name="first"], input[name="name"]').first();
    await expect(name).toBeVisible({ timeout: 5000 });
    await name.fill("QA TEST");
    // "Back" in the V3 stepper, "Change" on the classic card.
    await page.getByRole("button", { name: /^(change|back)$/i }).click();
    await expect(page.locator("[data-slot][aria-pressed=true]")).toHaveAttribute("aria-label", picked!);
    await expect(confirm).toBeEnabled();

    // Another session starts over.
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator(".stabs button[aria-checked=false]").first().click();
    await page.locator("[data-day]").first().waitFor({ timeout: 30_000 });
    await expect(confirm).toBeEnabled();
    expect(errors).toEqual([]);
    await ctx.close();
  });
}
