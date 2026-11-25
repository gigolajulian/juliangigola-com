/* BASELINE.md REL-7: every workflow runs with a read-only token unless it says otherwise, and every action is pinned to a
   full commit SHA (a moved tag cannot swap the code). Exits 1 with BEDROCK-FAIL on a miss. Run: node scripts/bedrock/ci-check.mjs */
import { readFileSync, readdirSync } from "node:fs";

const fail = (why) => { console.error(`BEDROCK-FAIL ${why}`); process.exit(1); };
let uses = 0;
for (const f of readdirSync(".github/workflows").filter((f) => /\.ya?ml$/.test(f))) {
  const y = readFileSync(`.github/workflows/${f}`, "utf8");
  if (!/^permissions:\s*\n\s+contents:\s*read\b/m.test(y)) fail(`${f} has no top-level permissions: contents: read`);
  for (const [, ref] of y.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)) {
    uses++;
    if (!ref.startsWith("./") && !/@[0-9a-f]{40}$/.test(ref)) fail(`${f}: ${ref} is not pinned to a commit SHA`);
  }
}
console.log(`${uses} actions pinned, read-only token`);
