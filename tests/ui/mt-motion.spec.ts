import { expect, test, type Page } from "@playwright/test";
import { errorsOn, open, RATIOS } from "./ratios";

/* The v4 home's motion layer (components/home/motion), as it runs today. On the
   desktop structure every held section gets --p, 0 to 1 through its hold
   (engine.ts); on a phone Book online and By quote take the bottom bar
   (data-bar, bars.ts) once their top is above 0.45 of the screen. Each section
   keeps its own bar while it is up there, so book and quote can carry it at once.
   Scrolled by script, not the wheel: Lenis would ease a wheel.
   On a fine pointer a held row glides to its nearest item once the scroll stops
   (motion/rows.ts, snap), and --p eases toward the scroll, so the --p check waits
   for --p to match the hold's progress where the scroll came to rest. The two
   ends are resting places of their own, so the snap leaves them at 0 and 1. */

const at = (name: string) => RATIOS.find((r) => r.name === name)!;
const to = (page: Page, y: number) => page.evaluate((top) => scrollTo({ top, behavior: "instant" }), y);
/** A section's top in page coordinates, its height, and the screen height. */
const boxOf = (page: Page, sel: string) =>
  page
    .locator(sel)
    .evaluate((el) => ({ top: el.getBoundingClientRect().top + scrollY, h: (el as HTMLElement).offsetHeight, vh: innerHeight }));
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
  await home(page);
  await expect(page.locator("html[data-mt-held]")).toBeAttached();

  const held = page.locator('[data-mt="motion"]');
  await expect(held).toHaveAttribute("data-hold");
  const { top, h, vh } = await boxOf(page, '[data-mt="motion"]');
  expect(h, "the hold makes the section taller than the screen").toBeGreaterThan(vh);
  /** --p, and the hold's progress at the scroll as it is now. */
  const read = () =>
    held.evaluate(
      (el, [t, run]) => ({ p: parseFloat(el.style.getPropertyValue("--p")), at: Math.min(1, Math.max(0, (scrollY - t) / run)) }),
      [top, h - vh] as const,
    );
  // the middle last: the snap glides from there to an item, and a jump made mid-glide is taken back by the glide
  for (const [y, want] of [
    [top, 0],
    [top + h - vh, 1],
    [top + (h - vh) / 2, null],
  ] as const) {
    await to(page, y);
    await expect
      .poll(
        async () => {
          const r = await read();
          return Math.abs(r.p - r.at);
        },
        { message: `--p follows the scroll from ${Math.round(y)}` },
      )
      .toBeLessThan(0.05);
    if (want !== null) expect((await read()).p, `--p at ${want}`).toBeCloseTo(want, 1);
  }

  await topAt(page, '[data-mt="book"]', 0.2);
  expect(await noBar(page, "book"), "book has no bar on a laptop").toBe(true);
  expect(errors).toEqual([]);
  await ctx.close();
});

test("phone: no holds, and Book online takes the bar once its top is above 0.45 of the screen", async ({
  browser,
  browserName,
}) => {
  const { ctx, page } = await open(browser, browserName, at("phone"));
  const errors = errorsOn(page);
  await home(page);
  await expect(page.locator("html[data-mt-held]")).toHaveCount(0);

  await topAt(page, '[data-mt="book"]', 0.8);
  expect(await noBar(page, "book"), "book low on the screen").toBe(true);

  await topAt(page, '[data-mt="book"]', 0.2);
  await expect.poll(() => bar(page, "book"), { message: "book up" }).toBe(true);

  await topAt(page, '[data-mt="book"]', 0.8);
  await expect.poll(() => bar(page, "book"), { message: "book back down" }).toBe(false);

  expect(errors).toEqual([]);
  await ctx.close();
});
