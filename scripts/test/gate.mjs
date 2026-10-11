/**
 * The suites a change needs, before it is committed.
 *
 * Julian's rule (2026-10-11): no code is committed until its tests pass.
 * A front-end change runs the frontend suite, a back-end change the
 * backend suite, a change to both runs both. Notes and docs run nothing.
 *
 *   node scripts/test/gate.mjs                 the staged files (the pre-commit hook)
 *   node scripts/test/gate.mjs --base main     everything on this branch since main
 *   node scripts/test/gate.mjs --all           both suites, whatever changed
 *   node scripts/test/gate.mjs --backend       the backend suite alone (or --frontend)
 *   node scripts/test/gate.mjs --files a,b     these files
 *   add --dry to only print which suites and why
 *
 * The suites:
 *   backend   tests/backend (Vitest, request-level: the API routes, the
 *             contact action, the book Worker, with fake KV and email),
 *             then the scripts/check-*.mjs self-checks. Seconds.
 *   frontend  route types, tsc, eslint and the lib unit tests, then a local
 *             production build checked in Chromium and Firefox: tests/ui at
 *             the six ratios and the perf suite's layout and image weight
 *             (scripts/perf/run.mjs --ui --rebuild). 20 to 30 minutes.
 *
 * The hook is `.githooks/pre-commit`, on once git is pointed at it:
 *   git config core.hooksPath .githooks
 */
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : null;
const given = argv.includes("--files") ? argv[argv.indexOf("--files") + 1] : null;
const forced = argv.includes("--all") || argv.includes("--backend") || argv.includes("--frontend");
const win = process.platform === "win32";

const git = (...args) => spawnSync("git", args, { encoding: "utf8" }).stdout.trim();
const files = forced
  ? null
  : (given ?? (base ? git("diff", "--name-only", `${base}...HEAD`) : git("diff", "--cached", "--name-only", "--diff-filter=ACMRD")))
      .split(given ? "," : "\n")
      .filter(Boolean);

/* Where a file belongs. First match wins. */
const RULES = [
  // Nothing to run: notes, docs, contact sheets, editor and CI settings.
  ["none", /^(docs\/|\.claude\/|\.github\/|\.githooks\/)|^HANDOFF[\w-]*\.md$|\.md$|^[^/]+\.png$|^\.gitignore$/],
  // Both: what every part of the site is built from.
  ["both", /^(package(-lock)?\.json|next\.config\.ts|tsconfig\.json|vitest\.config\.ts|eslint\.config\.mjs|proxy\.ts|middleware\.ts|open-next\.config\.ts|scripts\/test\/)/],
  // The server side: API routes, the contact action, the book Worker,
  // the inbox and the /admin plumbing, and their tests.
  ["backend", /^(app\/api\/|app\/contact\/actions\.ts$|app\/[\w.-]+\/route\.ts$|book\/|wrangler\.jsonc?$|tests\/backend\/|scripts\/check-)|^lib\/(inbox|vouch|admin-[\w-]+)\.ts$/],
  // Everything else is the site people see.
  ["frontend", /./],
];
const kind = (f) => RULES.find(([, re]) => re.test(f))[0];

let backend = argv.includes("--all") || argv.includes("--backend");
let frontend = argv.includes("--all") || argv.includes("--frontend");
for (const f of files ?? []) {
  const k = kind(f);
  if (k === "both" || k === "backend") backend = true;
  if (k === "both" || k === "frontend") frontend = true;
}

if (!backend && !frontend) {
  console.log(`gate: ${files.length ? "notes and docs only" : "nothing to check"}, no suite needed`);
  process.exit(0);
}
console.log(`gate: ${[backend && "backend", frontend && "frontend"].filter(Boolean).join(" + ")} suite${backend && frontend ? "s" : ""}`);
for (const f of files ?? []) console.log(`  ${kind(f).padEnd(8)} ${f}`);
// `--dry`: say which suites, run none.
if (argv.includes("--dry")) process.exit(0);

/* Each step in turn, stopping at the first that fails. npx goes through a
   shell on Windows, where it is npx.cmd. */
const steps = (name, list) => {
  console.log(`\ngate: ${name} suite`);
  for (const [cmd, ...args] of list) {
    const r = spawnSync(cmd, args, { stdio: "inherit", shell: win && cmd === "npx" });
    if (r.status !== 0) {
      console.log(`gate: ${name} failed at: ${[cmd, ...args].join(" ")}`);
      return 1;
    }
  }
  return 0;
};
const node = process.execPath;
const BACKEND = [
  ["npx", "vitest", "run", "--project", "backend"],
  [node, "scripts/test/checks.mjs"],
];
const FRONTEND = [
  ["npx", "next", "typegen"],
  ["npx", "tsc", "--noEmit"],
  ["npx", "eslint"],
  ["npx", "vitest", "run", "--project", "frontend"],
  [node, "scripts/perf/run.mjs", "--ui", "--rebuild"],
];
// Backend first: it takes seconds, the frontend suite builds the site.
const failed = (backend && steps("backend", BACKEND)) || (frontend && steps("frontend", FRONTEND));
console.log(failed ? "\ngate: FAILED, not committed. Fix it, or ask the thread that owns the code." : "\ngate: passed");
process.exit(failed ? 1 : 0);
