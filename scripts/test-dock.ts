import { test, expect } from "@playwright/test";

test("verify homepage header undocking animation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("http://localhost:3000/?v3motion", { waitUntil: "networkidle" });

  await page.waitForTimeout(1000);

  // Take screenshot at top
  await page.screenshot({ path: "home-top.png" });

  // Scroll down past header threshold
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: "smooth" }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: "home-scrolled-down.png" });

  // Scroll back up to top smoothly
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: "home-scrolled-up.png" });
});
