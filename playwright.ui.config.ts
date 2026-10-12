import { chromium, defineConfig, firefox, webkit } from "@playwright/test";
import { existsSync } from "node:fs";

/**
 * The frontend suite's behaviour checks (`tests/ui`): every page loads
 * clean, the /book picker, the booking menu and the booking pages, at the
 * six ratios. Run with `node scripts/test/gate.mjs --frontend`, which builds and serves a
 * local production build first (`scripts/perf/run.mjs --ui`).
 *
 * Chromium and Firefox. Safari is jg-MAC's, on a Mac (HANDOFF-qa.md);
 * UI_WEBKIT=1 adds Playwright's WebKit as a layout smoke test.
 */
const projects = [
  { name: "chromium", use: { browserName: "chromium" as const, ...(process.env.PERF_CHROME ? { channel: "chrome" } : {}) }, exe: chromium },
  { name: "firefox", use: { browserName: "firefox" as const }, exe: firefox },
  ...(process.env.UI_WEBKIT ? [{ name: "webkit", use: { browserName: "webkit" as const }, exe: webkit }] : []),
]
  .filter((p) => process.env.PERF_CHROME && p.name === "chromium" ? true : existsSync(p.exe.executablePath()))
  .map(({ name, use }) => ({ name, use }));

export default defineConfig({
  testDir: "tests/ui",
  fullyParallel: true,
  /* Cal.com answers the pickers live; one retry absorbs a slow answer, and
     the report still lists anything that needed it as flaky. */
  retries: 1,
  timeout: 120_000,
  outputDir: "test-results/ui",
  reporter: [["list"], ["html", { outputFolder: "test-results/ui-report", open: "never" }]],
  use: {
    baseURL: process.env.PERF_BASE_URL ?? "http://localhost:3100",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects,
});
