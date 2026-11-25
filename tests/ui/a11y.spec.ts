import { expect, test, type Browser } from "@playwright/test";
import { BOOKING_SLUGS } from "@/lib/booking/slugs";

/* Bedrock A11Y-2, A11Y-7 and MEM-6, against the local production build (`scripts/perf/run.mjs --ui`). */

const PAGES = ["/", "/portfolio", "/portfolio/editorial", "/book", "/legal", ...BOOKING_SLUGS.map((s) => `/${s}`)];

async function page(browser: Browser, opts: { width: number; height: number; reducedMotion?: "reduce" | "no-preference" }) {
  const ctx = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    reducedMotion: opts.reducedMotion,
    timezoneId: "America/Los_Angeles",
  });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("jg-intro", "1");
    } catch {}
  });
  return { ctx, page: await ctx.newPage() };
}

/** Running animations: name, length and repeats. */
const running = () =>
  document
    .getAnimations()
    .filter((a) => a.playState === "running")
    .map((a) => {
      const t = a.effect?.getTiming() ?? {};
      return { name: (a as CSSAnimation).animationName ?? a.id, duration: Number(t.duration) || 0, iterations: Number(t.iterations) };
    });

test.describe("reduced motion", () => {
  test("stops the site's motion when the visitor asks for less, and nothing ever flashes", async ({ browser }) => {
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      const { ctx, page: p } = await page(browser, { width: 1440, height: 900, reducedMotion });
      for (const path of ["/", "/portfolio", "/book"]) {
        await p.goto(path, { waitUntil: "load" });
        await p.waitForTimeout(2500);
        const anims = await p.evaluate(running);
        // Nothing repeats faster than three times a second (WCAG 2.3.1).
        expect(
          anims.filter((a) => a.iterations === Infinity && a.duration > 0 && a.duration < 334),
          `${path} flashes`,
        ).toEqual([]);
        if (reducedMotion === "reduce") expect(anims, `${path} moves under reduced motion`).toEqual([]);
        // The check sees motion when it is allowed: /portfolio's photos drift as they scroll.
        else if (path === "/portfolio") expect(anims.length).toBeGreaterThan(0);
      }
      await ctx.close();
    }
  });
});

test.describe("reflow", () => {
  test("every page fits 320 px wide, at normal and at 200% text, in English", async ({ browser }) => {
    const { ctx, page: p } = await page(browser, { width: 320, height: 700 });
    for (const path of PAGES) {
      for (const scale of ["100%", "200%"]) {
        await p.goto(path, { waitUntil: "load" });
        if (scale === "200%") await p.addStyleTag({ content: "html{font-size:200% !important}" });
        await p.waitForTimeout(600);
        const r = await p.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
          lang: document.documentElement.lang,
        }));
        expect(r.sw, `${path} at ${scale} scrolls sideways`).toBeLessThanOrEqual(r.cw);
        expect(r.lang).toBe("en");
      }
    }
    await ctx.close();
  });
});

test.describe("memory", () => {
  test("stays under its ceiling across forty page changes", async ({ browser, browserName }) => {
    test.skip(browserName !== "chromium", "the heap is read through Chromium's DevTools protocol");
    const { ctx, page: p } = await page(browser, { width: 1440, height: 900 });
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Performance.enable");
    const heapMb = async () => {
      await cdp.send("HeapProfiler.collectGarbage");
      const { metrics } = await cdp.send("Performance.getMetrics");
      return metrics.find((m) => m.name === "JSHeapUsedSize")!.value / 1e6;
    };
    await p.goto("/", { waitUntil: "load" });
    const rounds: number[] = [];
    for (let i = 0; i < 10; i++) {
      for (const path of ["/portfolio", "/book", "/legal", "/"]) {
        await p.evaluate((h) => (window as unknown as { next: { router: { push(h: string): void } } }).next.router.push(h), path);
        await p.waitForFunction((h) => location.pathname === h, path);
        await p.waitForTimeout(700);
      }
      rounds.push(await heapMb());
    }
    /* Measured 2026-11-25 on the local build: 7.3 MB after the first round, 8.6 MB after the tenth. The ceiling is
       about four times that, and the last five rounds may add at most 3 MB: a leak per page change fails both.
       MEM-1's budget is Julian's to set; these move with it. */
    expect(Math.max(...rounds), `heap by round: ${rounds.map((r) => r.toFixed(1)).join(" ")}`).toBeLessThan(35);
    expect(rounds[9] - rounds[4], `heap by round: ${rounds.map((r) => r.toFixed(1)).join(" ")}`).toBeLessThan(3);
    await ctx.close();
  });
});
