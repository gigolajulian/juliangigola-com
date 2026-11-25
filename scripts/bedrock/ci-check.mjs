/* BASELINE.md REL-7: every workflow runs with a read-only token unless it says otherwise, and every action is pinned to a
   full commit SHA (a moved tag cannot swap the code). Exits 1 with BEDROCK-FAIL on a miss. Run: node scripts/bedrock/ci-check.mjs */
import { readFileSync, readdirSync } from "node:fs";

const fail = (why) => { console.error(`BEDROCK-FAIL ${why}`); process.exit(1); };
let uses = 0;
for (const f of readdirSync(".github/workflows").filter((f) => /\.ya?ml$/.test(f))) {
  const y = readFileSync(`.github/workflows/${f}`, "utf8");
  // The top-level block: `permissions:` at column 0, then its indented lines, comments skipped.
  const lines = y.split(/\r?\n/).filter((l) => !/^\s*#/.test(l));
  const at = lines.findIndex((l) => /^permissions:\s*$/.test(l));
  const rest = at < 0 ? [] : lines.slice(at + 1);
  const end = rest.findIndex((l) => /^\S/.test(l));
  if (!(end < 0 ? rest : rest.slice(0, end)).map((l) => l.trim()).includes("contents: read")) fail(`${f} has no top-level permissions: contents: read`);
  for (const [, ref] of y.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)/gm)) {
    uses++;
    if (!ref.startsWith("./") && !/@[0-9a-f]{40}$/.test(ref)) fail(`${f}: ${ref} is not pinned to a commit SHA`);
  }
}
console.log(`${uses} actions pinned, read-only token`);
