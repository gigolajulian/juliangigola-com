/**
 * `npm run perf`: the perf suite against a local production build.
 *
 *   npm run perf                       # build if needed, serve, run, summarise
 *   npm run perf -- --rebuild          # build even if a local build is there
 *   npm run perf -- --project=webkit   # anything else goes to Playwright
 *   PERF_BASE_URL=http://localhost:3100 npm run perf   # a server already up
 *
 * The build is a local one (`JG_LOCAL=1`, `next.config.ts`): photographs
 * come from the live zone at production sizes and Safari can load it over
 * plain http. A build in `.next` that was made that way is reused; any
 * other build there (a Cloudflare one) is replaced.
 *
 * Two passes. The frame tests (@motion) first, one at a time, in headed
 * browsers, so nothing else is competing for the machine while frames are
 * timed. Then layout and image weight, side by side. Each pass prints its
 * own table (`tests/perf/reporter.ts`).
 *
 * Browsers that are not installed are left out with a note
 * (`playwright.config.ts`); `npx playwright install` adds them.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";

const argv = process.argv.slice(2);
const REBUILD = argv.includes("--rebuild");
const passThrough = argv.filter((a) => a !== "--rebuild");

const run = (cmd, args, env = {}) =>
  new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } });
    p.on("exit", (code) => resolve(code ?? 1));
  });

/** The first free port from 3100 up to 3199. */
const freePort = async () => {
  for (let port = Number(process.env.PERF_PORT ?? 3100); port < 3200; port++) {
    const ok = await new Promise((resolve) => {
      const s = createServer()
        .once("error", () => resolve(false))
        .once("listening", () => s.close(() => resolve(true)))
        .listen(port, "127.0.0.1");
    });
    if (ok) return port;
  }
  throw new Error("No free port between 3100 and 3199");
};

/** A build in `.next` made with JG_LOCAL=1 has the image proxy in its routes. */
const localBuild = () => {
  try {
    return (
      existsSync(".next/BUILD_ID") &&
      readFileSync(".next/routes-manifest.json", "utf8").includes("/cdn-cgi/image/")
    );
  } catch {
    return false;
  }
};

let server = null;
let base = process.env.PERF_BASE_URL;
let code = 0;

try {
  if (!base) {
    if (REBUILD || !localBuild()) {
      console.log("perf: building a local production build (JG_LOCAL=1)");
      code = await run("npx", ["next", "build"], { JG_LOCAL: "1" });
      if (code) throw new Error("build failed");
    } else {
      console.log("perf: reusing the local build in .next (--rebuild to make a new one)");
    }
    const port = await freePort();
    base = `http://localhost:${port}`;
    server = spawn("npx", ["next", "start", "-p", String(port)], { stdio: "ignore", detached: true });
    const t0 = Date.now();
    for (;;) {
      const up = await fetch(`${base}/legal`).then((r) => r.ok, () => false);
      if (up) break;
      if (Date.now() - t0 > 60_000) throw new Error(`server did not start on ${base}`);
      await new Promise((r) => setTimeout(r, 300));
    }
    console.log(`perf: serving on ${base}`);
  }

  const env = { PERF_BASE_URL: base };
  const motion = await run(
    "npx",
    ["playwright", "test", "--grep", "@motion", "--workers", "1", ...passThrough],
    { ...env, PERF_PHASE: "motion" },
  );
  const rest = await run(
    "npx",
    ["playwright", "test", "--grep-invert", "@motion", ...passThrough],
    { ...env, PERF_PHASE: "static" },
  );
  code = motion || rest;
} catch (err) {
  console.error(`perf: ${err.message}`);
  code = code || 1;
} finally {
  // The server and the process group `next start` spawned under it.
  if (server) {
    try {
      process.kill(-server.pid);
    } catch {}
  }
}
process.exit(code);
