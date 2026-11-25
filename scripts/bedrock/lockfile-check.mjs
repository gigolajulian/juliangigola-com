/* BASELINE.md SEC-3: the lockfile is committed and every install in CI uses it (`npm ci`, never `npm install`).
   Exits 1 with BEDROCK-FAIL on a miss. Run: node scripts/bedrock/lockfile-check.mjs */
import { readFileSync, readdirSync } from "node:fs";

const fail = (why) => { console.error(`BEDROCK-FAIL ${why}`); process.exit(1); };
let lock;
try { lock = JSON.parse(readFileSync("package-lock.json", "utf8")); } catch { fail("package-lock.json missing or unreadable"); }
if (!(lock.lockfileVersion >= 2)) fail(`lockfileVersion ${lock.lockfileVersion}`);
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }))
  if (!lock.packages?.[`node_modules/${name}`]) fail(`${name} is in package.json but not in the lockfile`);
let installs = 0;
for (const f of readdirSync(".github/workflows")) {
  const y = readFileSync(`.github/workflows/${f}`, "utf8");
  if (/\bnpm (install|i)\b(?!\s+-g)/.test(y) || /\byarn( install)?\s*$/m.test(y)) fail(`${f} installs without the lockfile`);
  installs += (y.match(/\bnpm ci\b/g) ?? []).length;
}
if (!installs) fail("no `npm ci` in any workflow");
console.log(`lockfile v${lock.lockfileVersion}, ${installs} npm ci installs, none without it`);
