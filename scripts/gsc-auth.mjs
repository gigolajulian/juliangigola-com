// One-time: connect /admin's Traffic tab to Google Search Console.
//
//   node scripts/gsc-auth.mjs path\to\client_secret.json
//
// Opens Google's consent page (sign in as hello@juliangigola.com), catches
// the answer on localhost, and hands {client_id, client_secret,
// refresh_token} straight to `wrangler versions secret put GSC_OAUTH`.
// Nothing secret is printed. Read-only scope. Deploy afterwards so the
// Worker picks the secret up.
//
//   node scripts/gsc-auth.mjs path\to\client_secret.json cal
//
// The same for the booking engine (`lib/booking/gcal.ts`): hello@'s calendar,
// events and free/busy, plus Gmail read-only for the lead desk's timeline
// (`lib/leads/gmail-sync.ts`), into `GCAL_OAUTH`. The client must be an
// Internal one, or Google expires the refresh token after 7 days. It asks
// hello@'s free/busy once before saving, so a token that cannot read the
// calendar is never stored. With `cal` it saves the secret on both Workers,
// the site and `juliangigola-booking` (deploy that one first).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/gsc-auth.mjs <client_secret.json> [cal]");
const cal = process.argv[3] === "cal";
const SECRET = cal ? "GCAL_OAUTH" : "GSC_OAUTH";
const SCOPE = cal
  ? "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/gmail.readonly"
  : "https://www.googleapis.com/auth/webmasters.readonly";
const raw = JSON.parse(readFileSync(file, "utf8"));
const { client_id, client_secret } = raw.installed ?? raw.web ?? raw;
const PORT = 53682;
const redirect_uri = `http://127.0.0.1:${PORT}`;

const consent =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id,
    redirect_uri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    login_hint: "hello@juliangigola.com",
  });

const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, redirect_uri);
    const got = url.searchParams.get("code");
    res.end(got ? "Connected. You can close this tab." : `Google said: ${url.searchParams.get("error")}`);
    server.close();
    got ? resolve(got) : reject(new Error(url.searchParams.get("error") ?? "no code"));
  }).listen(PORT, "127.0.0.1", () => {
    console.log("Opening Google sign-in. Choose hello@juliangigola.com and allow.");
    spawn("cmd", ["/c", "start", "", consent.replace(/&/g, "^&")], { stdio: "ignore", detached: true }).unref();
  });
});

const tok = await (
  await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ code, client_id, client_secret, redirect_uri, grant_type: "authorization_code" }),
  })
).json();
if (!tok.refresh_token) throw new Error(`No refresh token from Google: ${tok.error_description ?? tok.error ?? "unknown"}`);

if (cal) {
  const now = new Date();
  const fb = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ timeMin: now.toISOString(), timeMax: new Date(+now + 864e5).toISOString(), items: [{ id: "primary" }] }),
  });
  if (!fb.ok) throw new Error(`Signed in, but the calendar answered ${fb.status}. Nothing was saved.`);
  console.log("Calendar reachable.");
}

const value = JSON.stringify({ client_id, client_secret, refresh_token: tok.refresh_token });
const put = (args) =>
  new Promise((done) => {
    const w = spawn("cmd", ["/c", "npx", "wrangler", ...args], { stdio: ["pipe", "inherit", "inherit"] });
    w.stdin.end(value);
    w.on("exit", (c) => done(c === 0));
  });
let ok = await put(["versions", "secret", "put", SECRET, "--name", "juliangigola"]);
// The booking lock's own Worker (`worker/wrangler.jsonc`) reads the calendar too.
if (ok && cal) ok = await put(["secret", "put", SECRET, "--name", "juliangigola-booking"]);
console.log(ok ? `Saved ${SECRET}. Tell Claude: done.` : "wrangler failed, see above.");
