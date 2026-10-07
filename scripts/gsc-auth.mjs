// One-time: connect /admin's Traffic tab to Google Search Console.
//
//   node scripts/gsc-auth.mjs path\to\client_secret.json
//
// Opens Google's consent page (sign in as hello@juliangigola.com), catches
// the answer on localhost, and hands {client_id, client_secret,
// refresh_token} straight to `wrangler versions secret put GSC_OAUTH`.
// Nothing secret is printed. Read-only scope. Deploy afterwards so the
// Worker picks the secret up.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/gsc-auth.mjs <client_secret.json>");
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
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
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

const wrangler = spawn("cmd", ["/c", "npx", "wrangler", "versions", "secret", "put", "GSC_OAUTH", "--name", "juliangigola"], {
  stdio: ["pipe", "inherit", "inherit"],
});
wrangler.stdin.end(JSON.stringify({ client_id, client_secret, refresh_token: tok.refresh_token }));
wrangler.on("exit", (c) => console.log(c === 0 ? "Saved GSC_OAUTH. Tell Claude: done." : "wrangler failed, see above."));
