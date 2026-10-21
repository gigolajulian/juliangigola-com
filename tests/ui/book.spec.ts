import { expect, test, type Page } from "@playwright/test";
import { CONFIRM, errorsOn, open, pickTime, RATIOS, SHORT, upright } from "./ratios";

/* The /book time picker, at the six ratios and the short desktop where
   it draws at 80%. Times come from fixtures (`open`, ratios.ts). Never submitted: the
   form is opened and filled "QA TEST", then Change takes it back. */

const rect = (page: Page, sel: string) =>
  page.locator(sel).first().evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  });

for (const r of [...RATIOS, SHORT]) {
  test(`/book picks a time at ${r.name}`, async ({ browser, browserName }) => {
    const { ctx, page } = await open(browser, browserName, r);
    const errors = errorsOn(page);
    await page.goto("/book?session=headshots", { waitUntil: "load" });
    if (await upright(page, r, browserName)) return ctx.close();
    const confirm = page.getByRole("button", { name: CONFIRM });
    await page.locator("[data-day]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);

    // Nothing picked: Confirm is off. A day alone keeps it off.
    await expect(confirm).toBeDisabled();
    await page.locator("[data-day]:not([disabled]):visible").first().click();
    await expect(confirm).toBeDisabled();

    // A time turns it on.
    await pickTime(page);
    await expect(confirm).toBeEnabled();
    const picked = await page.locator("[data-slot][aria-pressed=true]").getAttribute("aria-label");

    // The picker never scrolls inside itself, nor the page sideways. The one
    // exception: in a wide editorial card the times run in their own column
    // beside the month and scroll there (2026-10-21), the month never does.
    const inner = await page.locator("[role=region].tp").evaluate((e) =>
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
      const zoom = parseFloat(getComputedStyle(document.querySelector(".book-page")!).zoom) || 1;
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
    await page.getByRole("button", { name: /^change$/i }).click();
    await expect(page.locator("[data-slot][aria-pressed=true]")).toHaveAttribute("aria-label", picked!);
    await expect(confirm).toBeEnabled();

    // Another session starts over.
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator("button.group.grid[aria-pressed=false]").first().click();
    await page.locator("[data-day]").first().waitFor({ timeout: 30_000 });
    await expect(confirm).toBeDisabled();
    expect(errors).toEqual([]);
    await ctx.close();
  });
}

test("/book?classic month view: the label on one line, January's six rows clear of Confirm on a short screen", async ({ browser, browserName }) => {
  const { ctx, page } = await open(browser, browserName, SHORT);
  await page.goto("/book?session=headshots&classic", { waitUntil: "load" });
  await page.locator("[data-day]").first().waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /^month$/i }).click();
  await page.waitForTimeout(700);
  expect(await page.locator("[data-day]:visible").count()).toBeGreaterThanOrEqual(28);
  /* Where the month and the times do not fit together (`data-split`) the
     month comes alone first: open the picked day to reach the label. CI's
     Firefox at 1280x720 splits; Windows sits just under the line. */
  const split = (await page.locator(".tp[data-split]").count()) > 0;
  if (split) {
    await page.locator("[data-day][aria-pressed=true]").click();
    await page.waitForTimeout(500);
  }
  const lines = await page.locator("p.label", { hasText: /Pick a time/i }).first().evaluate((el) => {
    const rg = document.createRange();
    rg.selectNodeContents(el);
    return [...rg.getClientRects()].filter((q) => q.height).sort((a, b) => a.top - b.top)
      .reduce((a, q) => (q.top >= a.b - 1 ? { n: a.n + 1, b: q.bottom } : { n: a.n, b: Math.max(a.b, q.bottom) }), { n: 0, b: -1e9 }).n;
  });
  expect(lines, "month label lines").toBe(1);
  if (split) {
    await page.locator('[data-part="back"]').click();
    await page.waitForTimeout(500);
  }
  const later = page.getByRole("button", { name: "Later" });
  for (let i = 0; i < 6 && !(await page.getByText("January 2027").count()); i++) {
    await later.click();
    await page.waitForTimeout(700);
  }
  test.skip(!(await page.getByText("January 2027").count()), "January 2027 is past the booking window");
  const rows = await page.locator("[role=region].tp [data-day]").evaluateAll((ns) => new Set(ns.filter((n) => (n as HTMLElement).offsetParent).map((n) => Math.round(n.getBoundingClientRect().y))).size);
  expect(rows).toBe(6);
  const c = await rect(page, "[role=region].tp");
  expect(c.bottom).toBeLessThanOrEqual(SHORT.height + 1);
  await ctx.close();
});
