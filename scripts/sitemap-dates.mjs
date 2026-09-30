/**
 * When each photograph folder last changed, from git, for the sitemap's
 * `<lastmod>`. Julian (2026-09-30): "add lastmod dates and images to the
 * sitemap".
 *
 * Written to `lib/sitemap-dates.json` and committed, because the build that
 * ships is not a place git history can be trusted: Workers Builds makes a
 * shallow clone, where every file's last commit is the one being built,
 * and a sitemap that says everything changed today is one Google learns to
 * ignore. So:
 *
 *   - Run here, on a full clone, it reads the history and rewrites the file.
 *   - Run on a shallow clone, it first fetches the rest of the history
 *     without its blobs (`--filter=blob:none`: commits and trees only, a few
 *     seconds, where the photographs' 1GB of blobs would be minutes). The
 *     repo is public, so no token is needed.
 *   - If that fails, it writes nothing and the committed file stands. It
 *     never fails a build, like the other generators.
 *
 * Keyed by what `app/sitemap.ts` looks up: a project's folder under
 * `public/work/` ("/work/nova"), any other public file by its own path
 * ("/hero/wired.jpg"), and the legal page's sources as "legal". A folder
 * rather than a file per frame, because a frame removed from a project is
 * a change to its page too, and the removed file is still in the history.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const OUT = "lib/sitemap-dates.json";
/** The legal page is words in components, not photographs. */
const LEGAL = [
  "app/legal/page.tsx",
  "components/legal.tsx",
  "components/terms.tsx",
  "components/privacy.tsx",
];

const git = (...args) =>
  execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    encoding: "utf8",
    maxBuffer: 64 << 20,
  });
const shallow = () => git("rev-parse", "--is-shallow-repository").trim() === "true";

try {
  if (shallow()) git("fetch", "--quiet", "--unshallow", "--filter=blob:none", "origin");
  if (shallow()) throw new Error("still a shallow clone");

  const dates = {};
  let date;
  // Newest commit first, so the first date a key meets is its latest.
  const log = git(
    "log", "--format=%cI", "--name-only", "--",
    "public/work", "public/hero", "public/covers", ...LEGAL,
  );
  for (const line of log.split("\n")) {
    if (/^\d{4}-\d\d-\d\dT/.test(line)) date = line;
    else if (line) {
      const parts = line.split("/"); // public, work, <slug>, <file>
      const key = LEGAL.includes(line)
        ? "legal"
        : parts[1] === "work" && parts.length > 3
          ? `/work/${parts[2]}`
          : line.slice("public".length);
      dates[key] ??= date;
    }
  }
  writeFileSync(OUT, JSON.stringify(dates, null, 1) + "\n", "utf8");
  console.log(`sitemap-dates: ${Object.keys(dates).length} dates`);
} catch (e) {
  console.warn(`sitemap-dates: kept the committed ${OUT} (${e.message})`);
}
