#!/usr/bin/env node
/* Before a deploy: is this build still main's newest commit?
 *
 * 2026-10-16 two merges close together started two Workers Builds, and the
 * older one finished last and replaced the newer site (#187 over #185).
 * Workers Builds runs this as the start of its deploy command:
 *
 *   node scripts/deploy-guard.mjs && <the deploy command>
 *
 * It compares the commit being built (WORKERS_CI_COMMIT_SHA, set by
 * Workers Builds) with main on GitHub (the repo is public, so no token).
 * When main has moved on, it exits 1 and the deploy step stops: the newer
 * commit's own build deploys instead. Outside Workers Builds, or when
 * GitHub can't be asked, it lets the deploy through: a guard that blocks
 * every deploy while GitHub is down would be worse than the race.
 */
import { execFileSync } from "node:child_process";

const built = process.env.WORKERS_CI_COMMIT_SHA;
if (!built) {
  console.log("deploy-guard: not a Workers Build, nothing to check");
  process.exit(0);
}

let head = "";
try {
  head = execFileSync("git", ["ls-remote", "https://github.com/gigolajulian/juliangigola-com.git", "refs/heads/main"], {
    encoding: "utf8",
    timeout: 20000,
  }).split(/\s/)[0];
} catch (e) {
  console.log(`deploy-guard: could not read main (${String(e).slice(0, 120)}), deploying anyway`);
  process.exit(0);
}

if (head && head !== built) {
  console.log(`deploy-guard: this build is ${built.slice(0, 7)}, main is ${head.slice(0, 7)}. Skipping: main's own build deploys.`);
  process.exit(1);
}
console.log(`deploy-guard: ${built.slice(0, 7)} is main, deploying`);
