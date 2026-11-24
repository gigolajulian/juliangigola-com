import { expect, test, type Page } from "@playwright/test";
import { errorsOn, open, RATIOS } from "./ratios";

/* The v4 home's motion layer (components/home/motion), as it runs today. On the
   desktop structure every held section gets --p, 0 to 1 through its hold
   (engine.ts); on a phone Book online and By quote take the bottom bar
   (data-bar, bars.ts) once their top is above 0.45 of the screen. Each section
   keeps its own bar while it is up there, so book and quote can carry it at once.
   Scrolled by script, not the wheel: Lenis would ease a wheel.
   On a fine pointer a held row glides to its nearest item once the scroll stops
   (motion/rows.ts, snap), so the --p check turns that off with ?mtsnap=0 to read
   --p at the exact scroll it set. */

const at = (name: string) => RATIOS.find((r) => r.name === name)!;
const to = (page: Page, y: number) => page.evaluate((top) => scrollTo({ top, behavior: "instant" }), y);
/** A section's top in page coordinates, its height, and the screen height. */
const boxOf = (page: Page, sel: string) =>
  page.locator(sel).evaluate((el) => ({ top: el.getBoundingClientRect().top + scrollY, h: (el as HTMLElement).offsetHeight, vh: innerHeight }));
/** Scrolls until the section's top sits at f of the screen height. */
const topAt = async (page: Page, sel: string, f: number) => {
  const b = await boxOf(page, sel);
  await to(page, b.top - f * b.vh);
};
const bar = (page: Page, name: string) => page.locator(`[data-mt="${name}"]`).evaluate((el) => el.hasAttribute("data-bar"));
/** The section never takes the bar: sampled every 50 ms for 400 ms, every sample false. */
const noBar = (page: Page, name: string) =>
  page.locator(`[data-mt="${name}"]`).evaluate(async (el) => {
    for (let i = 0; i <= 8; i++) {
      if (el.hasAttribute("data-bar")) return false;
      if (i < 8) await new Promise((r) => setTimeout(r, 50));
    }
    return true;
  });

async function home(page: Page, q = "") {
  await page.goto(`/?intro=0${q}`, { waitUntil: "load" });
  await expect(page.locator("html[data-mt-motion]")).toBeAttached();
}

test("laptop: a held section's --p runs 0 to 1 through its hold, and no section takes the bar", async ({ browser, browserName }) => {
  const { ctx, page } = await open(browser, browserName, at("laptop"));
  const errors = errorsOn(page);
  await home(page, "&mtsnap=0");
  await expect(page.locator("html[data-mt-held]")).toBeAttached();

  const covers = page.locator('[data-mt="covers"]');
  await expect(covers).toHaveAttribute("data-hold");
  const p = () => covers.evaluate((el) => parseFloat(el.style.getPropertyValue("--p")));
  const { top, h, vh } = await boxOf(page, '[data-mt="covers"]');
  expect(h, "the hold makes the section taller than the screen").toBeGreaterThan(vh);
  for (const [y, want] of [[top, 0], [top + (h - vh) / 2, 0.5], [top + h - vh, 1]] as const) {
    await to(page, y);
    await expect.poll(p, { message: `--p at ${want}` }).toBeCloseTo(want, 1);
  }

  for (const name of ["book", "quote"]) {
    await topAt(page, `[data-mt="${name}"]`, 0.2);
    const [book, quote] = await Promise.all([noBar(page, "book"), noBar(page, "quote")]);
    expect(book, `book has no bar with ${name} up`).toBe(true);
    expect(quote, `quote has no bar with ${name} up`).toBe(true);
  }
  expect(errors).toEqual([]);
  await ctx.close();
});

test("phone: no holds, and Book online and By quote take the bar once their top is above 0.45 of the screen", async ({ browser, browserName }) => {
  const { ctx, page } = await open(browser, browserName, at("phone"));
  const errors = errorsOn(page);
  await home(page);
  await expect(page.locator("html[data-mt-held]")).toHaveCount(0);

  await topAt(page, '[data-mt="book"]', 0.8);
  expect(await noBar(page, "book"), "book low on the screen").toBe(true);

  await topAt(page, '[data-mt="book"]', 0.2);
  await expect.poll(() => bar(page, "book"), { message: "book up" }).toBe(true);
  expect(await bar(page, "quote"), "quote still below").toBe(false);

  await topAt(page, '[data-mt="book"]', 0.8);
  await expect.poll(() => bar(page, "book"), { message: "book back down" }).toBe(false);

  await topAt(page, '[data-mt="quote"]', 0.2);
  await expect.poll(() => bar(page, "quote"), { message: "quote up" }).toBe(true);
  expect(errors).toEqual([]);
  await ctx.close();
});
