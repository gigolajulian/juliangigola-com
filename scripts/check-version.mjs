/* REL-9: one version for the site. version.json is the line (package.json stays out of commits and shows nowhere); next.config.ts reads it into BUILD_VERSION,
   /api/build reports it, RELEASES.md's newest entry names it, and it is never behind the newest v* release tag.
   Prints BEDROCK-FAIL and exits 1 on any disagreement. `node scripts/check-version.mjs` */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const fail = [];
const version = JSON.parse(readFileSync("version.json", "utf8")).version;
if (!/^\d+\.\d+\.\d+$/.test(version)) fail.push(`version.json's ${version} is not x.y.z`);

const config = readFileSync("next.config.ts", "utf8");
if (
  !/BUILD_VERSION:\s*SITE_VERSION\b/.test(config) ||
  !/SITE_VERSION(?::\s*string)?\s*=\s*JSON\.parse\(readFileSync\("version\.json"/.test(config)
)
  fail.push("next.config.ts does not take BUILD_VERSION from version.json");
if (!/version:\s*process\.env\.BUILD_VERSION/.test(readFileSync("app/api/build/route.ts", "utf8")))
  fail.push("/api/build does not report BUILD_VERSION");

const notes = readFileSync("RELEASES.md", "utf8");
const top = /^## (v\d+\.\d+\.\d+|Unreleased)/m.exec(notes)?.[1];
if (top !== `v${version}` && top !== "Unreleased") fail.push(`RELEASES.md's newest entry is ${top}, not v${version}`);

const newer = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};
let tag = "";
try {
  tag = execFileSync("git", ["tag", "--list", "v*", "--sort=-v:refname"], { encoding: "utf8" }).split("\n")[0].trim();
} catch {
  // No git or no tags (a shallow CI clone): the file checks above still run.
}
if (tag && newer(tag.slice(1), version)) fail.push(`version.json ${version} is behind the newest release tag ${tag}`);

if (fail.length) {
  console.log(`BEDROCK-FAIL version: ${fail.join("; ")}`);
  process.exit(1);
}
console.log(`version: ${version}${tag ? `, newest tag ${tag}` : ""}, RELEASES.md ${top}`);
