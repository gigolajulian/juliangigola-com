import { expect, test } from "@playwright/test";
import { CONFIRM, errorsOn, open, RATIOS, upright } from "./ratios";

/* The homepage's Sessions (V4, `components/home/book-online.tsx`): a row opens
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

/* The other old links: /#about lands on About, /#contact on the footer with the inquiry card open (/about and /contact are pages of their own). */
for (const r of [RATIOS[0], RATIOS[4]]) {
  test(`old anchors at ${r.name}`, async ({ browser, browserName }) => {
    const { ctx, page } = await open(browser, browserName, r);
    await page.goto("/#about", { waitUntil: "load" });
    await expect.poll(() => page.locator("#about").evaluate((e) => Math.abs(Math.round(e.getBoundingClientRect().top)))).toBeLessThan(80);
    // a full load: a hash-only move this soon after the first load races the router
    await page.goto("/#contact");
    await page.reload({ waitUntil: "load" });
    const card = page.locator(".mt-inq");
    await expect(card).toBeVisible();
    expect(await card.evaluate((e) => e.contains(document.activeElement)), "focus is in the card").toBe(true);
    await expect(page.locator("footer#contact")).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(card).toHaveCount(0);
    await expect(page.locator("#contact .mt-ph-btn")).toBeFocused();
    await ctx.close();
  });
}

test("on the home, a link to /#contact glides to the footer, then opens the card", async ({ browser, browserName }) => {
  const { ctx, page } = await open(browser, browserName, RATIOS[4]);
  await page.goto("/", { waitUntil: "load" });
  await page.locator("#contact .mt-ph-btn").waitFor({ state: "attached" });
  // a fixed 1s was sometimes too early on CI (#1242, #1255: the card opened with the footer off screen);
  // the motion engine starts in the same effect pass that adds the home's click listener;
  // then the page height holds over two frames, so the glide aims at where the footer stays
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-mt-motion"), null, { timeout: 15000 });
  await expect.poll(() => page.evaluate(() => new Promise<boolean>((done) => {
    const h = document.documentElement.scrollHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => done(document.documentElement.scrollHeight === h)));
  })), { message: "page height holds" }).toBe(true);
  // no link on the home points there today: a stand-in, as any page link to /#contact would be
  await page.evaluate(() => {
    const a = Object.assign(document.createElement("a"), { href: "/#contact", id: "t-contact", textContent: "contact" });
    a.style.cssText = "position:fixed;left:4px;top:120px;z-index:99999";
    document.body.append(a);
  });
  await page.locator("#t-contact").click();
  await expect(page.locator(".mt-inq")).toBeVisible();
  await expect(page).toHaveURL(/\/#contact$/);
  await expect(page.locator("footer#contact")).toBeInViewport({ timeout: 10000 });
  await ctx.close();
});
