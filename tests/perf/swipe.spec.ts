import { expect, test } from "@playwright/test";
import budgets from "./budgets.json";
import {
  awake,
  frameStats,
  framesOff,
  framesOn,
  recordFrames,
  report,
  screens,
  settle,
  skipSplash,
  touchSwipe,
  wheelFlick,
} from "./helpers";
import { contextFor, stacked, VIEWPORTS } from "./matrix";

/**
 * Swipes, at every size: where each one lands and how its frames went.
 *
 * A pointer swipes with a trackpad flick (wheel deltas). A finger on an
 * iPad swipes the strip sideways. On a phone the strips stack down the
 * page, so a finger scrolls the page instead and only frames are kept.
 *
 * On the homepage every swipe must land exactly one screen on. On the
 * work index the strip runs free, so there only the frames are kept.
 *
 * Every page's frames are held to the budgets in `budgets.json`: the
 * median frame, the share of frames over 20ms, and the worst one.
 *
 * Headed: headless WebKit draws this site at a few frames a second.
 */

test.use({ headless: false });

const SWIPE_PAGES = ["/", "/portfolio"] as const;
/** Three on, one back. */
const PLAN = [1, 1, 1, -1] as const;

for (const path of SWIPE_PAGES) {
  test.describe(`swipe ${path} @motion`, () => {
    for (const v of VIEWPORTS) {
      test(`${v.name}`, async ({ browser, browserName }, info) => {
        const ctx = await browser.newContext(contextFor(v, browserName));
        try {
          await skipSplash(ctx);
          await recordFrames(ctx);
          const page = await ctx.newPage();
          await page.bringToFront();
          await page.goto(path, { waitUntil: "load" });
          await page.waitForTimeout(2500);
          test.skip(!(await awake(page)), "window throttled by macOS (covered, or its display asleep)");

          const home = path === "/";
          const landed: string[] = [];
          const misses: string[] = [];
          await framesOn(page);

          if (stacked(v)) {
            for (const sign of PLAN) {
              const h = v.height;
              await touchSwipe(page, sign > 0 ? h * 0.8 : h * 0.2, sign > 0 ? h * 0.2 : h * 0.8, 250, "y");
              await page.waitForTimeout(600);
            }
          } else {
            for (const sign of PLAN) {
              const before = await screens(page);
              const from = await page.evaluate(() => document.querySelector(".strip-scroll")!.scrollLeft);
              if (v.touch) {
                const w = v.width;
                await touchSwipe(page, sign > 0 ? w * 0.8 : w * 0.35, sign > 0 ? w * 0.35 : w * 0.8, 160);
              } else {
                await wheelFlick(page, sign);
              }
              const to = await settle(page);
              landed.push(((to - from) / before.width).toFixed(2));
              if (home) {
                /* The screen after (or before) the one the swipe started
                   on, as far as the strip can go. */
                const next =
                  sign > 0
                    ? Math.min(before.max, ...before.at.filter((a) => a > from + 1))
                    : Math.max(0, ...before.at.filter((a) => a < from - 1));
                if (Math.abs(to - next) > 2) misses.push(`${sign > 0 ? "on" : "back"} from ${Math.round(from)}: ${Math.round(to)}, not ${Math.round(next)}`);
              }
              await page.waitForTimeout(400);
            }
          }

          const st = frameStats(await framesOff(page));
          // Throttled part way through: the numbers are the OS's, not the site's.
          const valid = await awake(page);
          await report(info, {
            kind: "swipe",
            page: path,
            viewport: v.name,
            landed: valid ? landed.join(" ") || "stacked" : "throttled",
            ...st,
          });
          test.skip(!valid, "window throttled by macOS during the swipes");
          if (home && !stacked(v)) expect.soft(misses, "each swipe lands exactly one screen on").toEqual([]);
          const b = budgets.swipe;
          expect.soft(st.median, `median frame, budget ${b.medianMs}ms`).toBeLessThanOrEqual(b.medianMs);
          expect.soft(st.slow, `% of frames over 20ms, budget ${b.slowPct}%`).toBeLessThanOrEqual(b.slowPct);
          expect.soft(st.worst, `worst frame, budget ${b.worstMs}ms`).toBeLessThanOrEqual(b.worstMs);
        } finally {
          await ctx.close();
        }
      });
    }
  });
}
