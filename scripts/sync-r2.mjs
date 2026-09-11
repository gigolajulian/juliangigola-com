/**
 * Pushes the harvested archive to R2.
 *
 * `public/work/` is 275MB today and ~690MB once re-harvested at 2500px, which
 * is why it is not in the repo: git keeps every version of every blob forever,
 * so committing it once would make every clone pay for it for good.
 *
 * So the archive lives in an R2 bucket and the repo holds only the manifest
 * that points at it (`lib/work-data.ts`). Run this after `harvest.mjs`, and
 * after anything else that writes to `public/work/`.
 *
 *   node scripts/sync-r2.mjs           # upload what is missing
 *   node scripts/sync-r2.mjs --force   # re-upload everything
 *
 * Uploads only what the bucket does not already have, because a re-harvest
 * rewrites files that have not changed and a full push is ~690MB.
 */

import { readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const BUCKET = process.env.R2_BUCKET ?? "juliangigola-work";
const ROOT = "public/work";
const FORCE = process.argv.includes("--force");

/** How many uploads are in flight. Wrangler spawns a process per object. */
const CONCURRENCY = 8;

const walk = async (dir) => {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (/\.(jpe?g|png|webp|avif)$/i.test(entry.name)) out.push(full);
  }
  return out;
};

const run = (args) =>
  new Promise((resolve) => {
    const child = spawn("npx", ["wrangler", ...args], { shell: true, stdio: "pipe" });
    let err = "";
    child.stderr.on("data", (d) => (err += d));
    child.on("close", (code) => resolve({ code, err }));
  });

const exists = async (key) => {
  const { code } = await run(["r2", "object", "get", `${BUCKET}/${key}`, "--remote", "--pipe"]);
  return code === 0;
};

const files = await walk(ROOT);
if (!files.length) {
  console.error(`No images under ${ROOT}/. Run scripts/harvest.mjs first.`);
  process.exit(1);
}

console.log(`${files.length} files in ${ROOT}/${FORCE ? " (forcing re-upload)" : ""}`);

let uploaded = 0;
let skipped = 0;
let failed = 0;

/** The object key mirrors the public path, so `/work/x/01.jpg` maps 1:1. */
const keyOf = (file) => file.split(path.sep).join("/").replace(/^public\//, "");

const queue = [...files];
const worker = async () => {
  for (let file = queue.shift(); file; file = queue.shift()) {
    const key = keyOf(file);

    if (!FORCE && (await exists(key))) {
      skipped++;
      continue;
    }

    const { code, err } = await run([
      "r2",
      "object",
      "put",
      `${BUCKET}/${key}`,
      "--file",
      file,
      "--remote",
      // Without this every object serves as application/octet-stream, which
      // browsers download instead of rendering — and which Cloudflare Image
      // Transformations refuses outright.
      "--content-type",
      /\.png$/i.test(file) ? "image/png" : /\.webp$/i.test(file) ? "image/webp" : "image/jpeg",
      // A year. The manifest changes the path when a frame changes, so a
      // cached object is never a stale one.
      "--cache-control",
      "public, max-age=31536000, immutable",
    ]);

    if (code === 0) {
      uploaded++;
      if (uploaded % 25 === 0) console.log(`  ${uploaded} uploaded…`);
    } else {
      failed++;
      console.error(`  FAILED ${key}: ${err.trim().split("\n").pop()}`);
    }
  }
};

const bytes = (await Promise.all(files.map((f) => stat(f)))).reduce((n, s) => n + s.size, 0);
console.log(`${(bytes / 1024 ** 3).toFixed(2)} GB on disk\n`);

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`\nuploaded ${uploaded}, already present ${skipped}, failed ${failed}`);
// A partial sync is a site with missing photographs, so it must not look like
// a success to whatever called this.
process.exit(failed ? 1 : 0);
