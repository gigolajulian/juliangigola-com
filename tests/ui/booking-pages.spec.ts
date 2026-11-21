import { expect, test, type Page } from "@playwright/test";
import { CONFIRM, open, pickTime, RATIOS } from "./ratios";

/* The booking pages (/portraits, /weddings...): the deck ends at Book and
   stays there, and the page's own picker lets a time be confirmed. */

/** True when scrollY holds over two frames. */
const still = (page: Page) =>
  page.evaluate(() => new Promise<boolean>((done) => {
    const y = scrollY;
    requestAnimationFrame(() => requestAnimationFrame(() => done(scrollY === y)));
  }));

for (const r of RATIOS.filter((x) => !x.touch)) {
  test(`/portraits stays on Book past the last screen at ${r.name}`, async ({ browser, browserName }) => {
    const { ctx, page } = await open(browser, browserName, r);
    await page.goto("/portraits", { waitUntil: "load" });
    // Lenis takes the wheel once the page has hydrated (components/v3/smooth-scroll.tsx)
    await page.locator("html.lenis").waitFor({ state: "attached" });
    await page.mouse.move(r.width / 2, r.height / 2);
    for (let i = 0; i < 14; i++) {
      await page.mouse.wheel(0, 700);
      await expect.poll(() => still(page), { message: `wheel ${i + 1} settles` }).toBe(true);
    }
    const on = () => page.evaluate(() => {
      const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      const secs = [...document.querySelectorAll<HTMLElement>("section[data-label]")];
      return { path: location.pathname, onLast: !!secs.length && hit?.closest("section[data-label]") === secs.at(-1) };
    });
    await expect.poll(on, { message: "on the last screen of /portraits" }).toEqual({ path: "/portraits", onLast: true });
    await ctx.close();
  });
}

// V3: the booking lives at /book/<slug>, where the stepper's picker confirms
// a time (the service pages no longer carry an inline picker).
for (const slug of ["portraits", "music-photography"]) {
  for (const r of [RATIOS[0], RATIOS[4]]) {
    test(`/book/${slug}: a time can be confirmed at ${r.name}`, async ({ browser, browserName }) => {
      const { ctx, page } = await open(browser, browserName, r);
      await page.goto(`/book/${slug}`, { waitUntil: "load" });
      await page.locator("[data-day]").first().waitFor({ timeout: 30_000 });
      const day = page.locator("[data-day]:not([disabled]):visible").last();
      await day.click();
      await expect(day).toHaveAttribute("aria-pressed", "true");
      await pickTime(page, true);
      const confirm = page.getByRole("button", { name: CONFIRM });
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
