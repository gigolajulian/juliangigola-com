import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium, defineConfig, firefox, webkit, type Project } from "@playwright/test";

/**
 * The perf suite (`tests/perf`). Run it with `npm run perf`, which builds
 * or reuses a local production server first (`scripts/perf/run.mjs`).
 * Run directly, it expects a server at PERF_BASE_URL.
 *
 * The browsers are the support policy (README, "Browser support"): WebKit
 * for Safari on the Mac, iPhone and iPad, Chromium for Chrome and Edge,
 * and Firefox.
 */

/* On a Mac, WebKit goes through a launcher that keeps App Nap off
   (`scripts/perf/webkit-awake.sh`): a napping browser draws a few frames
   a second and the frame tests would be timing the OS. */
const mac = process.platform === "darwin";
if (mac) process.env.PERF_WEBKIT = webkit.executablePath();

const BROWSERS: Project[] = [
  {
    name: "webkit",
    use: {
      browserName: "webkit",
      launchOptions: mac ? { executablePath: "scripts/perf/webkit-awake.sh" } : {},
    },
  },
  {
    name: "chromium",
    use: {
      browserName: "chromium",
      /* Chromium's own throttling of a window in the background, off for
         the same reason as App Nap above. */
      launchOptions: {
        args: [
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
        ],
      },
    },
  },
  { name: "firefox", use: { browserName: "firefox" } },
];

/* A browser that is not installed is left out rather than failing every
   test it would have run. `npx playwright install` adds it, and marks the
   folder it unpacked with INSTALLATION_COMPLETE once it has finished; a
   folder without the mark is an install cut short. */
const BROWSER_TYPES = { webkit, chromium, firefox };
const complete = (exe: string) => {
  for (let dir = dirname(exe); dir !== dirname(dir); dir = dirname(dir)) {
    if (existsSync(join(dir, "INSTALLATION_COMPLETE"))) return true;
  }
  return false;
};
const installed = BROWSERS.filter((p) => {
  const exe = BROWSER_TYPES[p.name as keyof typeof BROWSER_TYPES].executablePath();
  const ok = existsSync(exe) && complete(exe);
  if (!ok && !process.env.TEST_WORKER_INDEX) console.log(`perf: ${p.name} is not installed, skipped (npx playwright install ${p.name})`);
  return ok;
});

export default defineConfig({
  testDir: "tests/perf",
  /* Layout and image checks run side by side. The frame tests are tagged
     @motion and the runner gives them one worker of their own. */
  fullyParallel: true,
  retries: 0,
  outputDir: "test-results/artifacts",
  timeout: 90_000,
  reporter: [["./tests/perf/reporter.ts"]],
  use: {
    baseURL: process.env.PERF_BASE_URL ?? "http://localhost:3100",
    headless: true,
  },
  projects: installed,
});
