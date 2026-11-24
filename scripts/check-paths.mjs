/**
 * Every backticked repo path in the source (`lib/...`, `components/...`,
 * `app/...`, `scripts/...`, `types/...`, `tests/...`) names a file or folder
 * that exists. A comment that points at a moved or deleted module sends the
 * next reader to nothing.
 *
 * A path may leave off its extension, as an import does.
 *
 *   node scripts/check-paths.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components", "lib", "scripts", "types", "tests", "README.md", "next.config.ts", "image-loader.ts", "wrangler.jsonc"];
const TEXT = /\.(ts|tsx|mjs|mts|js|cjs|css|md|jsonc)$/;
const PATH = /`((?:lib|components|app|scripts|types|tests)\/[^`\s*]+?)`/g;
const EXTS = ["", ".ts", ".tsx", ".mjs", ".mts", ".js", ".css", ".json", "/index.ts", "/index.tsx"];
// Placeholders written as examples, not as references.
const EXAMPLES = new Set(["lib/x.ts"]);

const files = [];
const walk = (p) => {
  if (!existsSync(p)) return;
  if (!statSync(p).isDirectory()) {
    if (TEXT.test(p)) files.push(p);
    return;
  }
  for (const n of readdirSync(p)) if (n !== "node_modules" && !n.startsWith(".")) walk(join(p, n));
};
ROOTS.forEach(walk);

const resolves = (raw) => {
  const p = raw.replace(/[#:].*$/, "").replace(/[\\.,;)]+$/, "");
  if (EXAMPLES.has(p) || /[<{]/.test(p)) return true;
  return EXTS.some((e) => existsSync(p + e));
};

const broken = [];
for (const f of files) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    for (const m of line.matchAll(PATH)) if (!resolves(m[1])) broken.push(`${f}:${i + 1}: ${m[1]}`);
  });
}

if (broken.length) {
  console.error(`paths: ${broken.length} named but missing\n${broken.join("\n")}`);
  process.exit(1);
}
console.log(`paths: ${files.length} files, every named path exists`);
