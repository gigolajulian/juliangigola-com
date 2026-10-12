/* The backend suite's second half: the self-checks that run the real
   inbox, /admin payload, sequence and video-link code under Node's type
   stripping (`scripts/check-*.mjs`). Stops at the first that fails. */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

for (const f of readdirSync("scripts").filter((f) => /^check-.*\.mjs$/.test(f)).sort()) {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", "--no-warnings", `scripts/${f}`], { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`checks: scripts/${f} failed`);
    process.exit(r.status ?? 1);
  }
}
