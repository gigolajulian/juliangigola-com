/* Makes the lead desk's VAPID key and stores it as the Worker secret
 * VAPID_KEY, without ever printing it. Run once:
 *
 *   node scripts/vapid-setup.mjs          (the live Worker)
 *   node scripts/vapid-setup.mjs --local  (.dev.vars, for next dev)
 *
 * A new key logs every subscribed device out of notifications; turn them
 * on again on the desk after running it.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const { kty, crv, x, y, d } = await crypto.subtle.exportKey("jwk", pair.privateKey);
const secret = JSON.stringify({ kty, crv, x, y, d });

if (process.argv.includes("--local")) {
  const vars = readFileSync(".dev.vars", "utf8");
  if (/^VAPID_KEY=/m.test(vars)) throw new Error(".dev.vars already has VAPID_KEY; remove that line first.");
  appendFileSync(".dev.vars", `${vars.endsWith("\n") ? "" : "\n"}VAPID_KEY=${secret}\n`);
  console.log("VAPID_KEY added to .dev.vars");
} else {
  const r = spawnSync("npx", ["wrangler", "versions", "secret", "put", "VAPID_KEY"], { input: secret, stdio: ["pipe", "inherit", "inherit"], shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
  console.log("VAPID_KEY set on the Worker. The next deploy carries it.");
}
