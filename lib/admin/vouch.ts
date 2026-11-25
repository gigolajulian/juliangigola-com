import { isGithubToken, REPO } from "@/lib/admin/github-repo";
import { json } from "@/lib/http";
import { sha256Hex } from "@/lib/token";
import { outbound } from "@/lib/net";

/* ── the key the editor already has ───────────────────────────────
 * Whoever can push to the repository publishes the site, so a GitHub token
 * that can push is the site's real credential and the one /admin already
 * holds. A request carrying it as a bearer token is checked against GitHub
 * — does this token see the repository, with push? — and the answer is
 * remembered for five minutes by a hash of it, so a panel's every read is
 * not a round trip. Every write asks GitHub again (`fresh`): a token revoked
 * at GitHub stops changing anything at once, and reads within five minutes.
 * Signing out everywhere is revoking the token at GitHub, or rotating the
 * INBOX_KEY secret for the admin key.
 *
 * Two gates, one copy each, so a change to how the site trusts a request is
 * a change in one place:
 * - `isAdmin`: every /admin data route checks it, directly or through `gate()`
 *   in `lib/admin/gate.ts`.
 *   The admin key (`x-admin-key`, checked against the `INBOX_KEY` secret) or a GitHub token that can push. `refuseAdmin` is
 *   the same gate as the 401 every one of those routes answers.
 * - `fromWorker`: the booking Worker calling the site (leads/gmail,
 *   leads/mail, leads/sheet, leads/weekly, proof/daily), with `WORKER_KEY` as the bearer.
 * ─────────────────────────────────────────────────────────────── */
const VOUCHED_MS = 5 * 60 * 1000;
const vouched = new Map<string, number>();
/** Drops every remembered token, so a test starts from a cold isolate. */
export const forgetVouches = () => vouched.clear();

const sha256Bytes = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));

/**
 * The two kinds of token /admin is set up with: a fine-grained one (what its
 * setup page asks for) or a classic PAT. OAuth, app and refresh tokens
 * (gho_, ghu_, ghs_, ghr_) are refused before any fetch, as is anything
 * else: otherwise every made-up bearer string costs a call to GitHub, and
 * enough of those gets the Worker's egress rate-limited there.
 */
const CLASSIC = /^ghp_[A-Za-z0-9]{20,255}$/;
const FINE = /^github_pat_[A-Za-z0-9_]{20,255}$/;

const API = `https://api.github.com/repos/${REPO.owner}/${REPO.repo}`;
// Bounded, and closed on failure: a slow GitHub must not hang the gate
// open, and an unreachable one must not open it.
const ask = (token: string, path = "", init: RequestInit = {}) =>
  outbound(API + path, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "juliangigola-admin",
    },
  });

async function vouch(token: string, fresh = false): Promise<boolean> {
  if (!isGithubToken(token)) return false;
  const classic = CLASSIC.test(token);
  if (!classic && !FINE.test(token)) return false;
  const id = await sha256Hex(token);
  const until = vouched.get(id);
  if (!fresh && until && until > Date.now()) return true;
  vouched.delete(id);

  // The user's role: can whoever owns this token push here at all?
  const res = await ask(token);
  if (!res.ok) {
    await res.body?.cancel();
    return false;
  }
  const repo = (await res.json()) as { permissions?: { push?: boolean } };
  if (repo.permissions?.push !== true) return false;

  // The token's own grant. A classic token lists its scopes in a header.
  // A fine-grained one has none to read, so it is asked to write a file with
  // no content: GitHub answers 403/404 when the token lacks Contents write,
  // and 422 (fields missing) when it has it. Nothing is ever written.
  let ok: boolean;
  if (classic) {
    const scopes = (res.headers.get("x-oauth-scopes") ?? "").split(",").map((s) => s.trim());
    ok = scopes.includes("repo") || scopes.includes("public_repo");
  } else {
    const probe = await ask(token, "/contents/.vouch", { method: "PUT", body: "{}" });
    await probe.body?.cancel();
    ok = probe.status === 422;
  }
  if (ok) vouched.set(id, Date.now() + VOUCHED_MS);
  return ok;
}

/** True when GitHub says this token can push to the site's repository. */
export async function canPush(token: string, fresh = false): Promise<boolean> {
  try {
    return await vouch(token, fresh);
  } catch {
    return false;
  }
}

/** The bearer token on a request, when it carries one. */
export const bearer = (request: Request): string | undefined => /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];

/**
 * Whether the request carries the right key.
 *
 * Constant-time, so the comparison cannot be used to learn the key one
 * character at a time. Both sides are hashed first, which fixes the length —
 * otherwise the loop below would return early on a shorter guess and the
 * key's own length would leak.
 *
 * Written out rather than calling the runtime's `timingSafeEqual`: this is
 * thirty-two fixed iterations of XOR, it is the same guarantee, and it runs
 * in a test under Node without a Workers shim.
 */
export function authorised(request: Request, expected?: string) {
  return sameSecret(request.headers.get("x-admin-key"), expected);
}

async function sameSecret(given?: string | null, expected?: string) {
  if (!expected || !given) return false;
  const [a, b] = await Promise.all([sha256Bytes(given), sha256Bytes(expected)]);

  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** The booking Worker, calling with `WORKER_KEY` as its bearer. */
export const fromWorker = (request: Request, secret?: string) => sameSecret(bearer(request), secret);

/** The booking Worker's gate as a route answers it: null when let in, else the 401. */
export async function refuseWorker(request: Request, secret?: string): Promise<Response | null> {
  if (await fromWorker(request, secret)) return null;
  return json({ error: "Not authorized." }, 401);
}

/** The admin gate: the admin key, or a GitHub token that can push. A write re-checks the token with GitHub, never the cache. */
export async function isAdmin(request: Request, key?: string) {
  if (await authorised(request, key)) return true;
  const token = bearer(request);
  const write = !["GET", "HEAD"].includes(request.method.toUpperCase());
  return !!token && (await canPush(token, write));
}

/**
 * The admin gate as a route answers it: null when let in, else the 401. The two messages differ so a wrong
 * token can be told from a missing one, never which characters were wrong.
 */
export async function refuseAdmin(request: Request, key?: string): Promise<Response | null> {
  if (await isAdmin(request, key)) return null;
  return json({ error: bearer(request) ? "GitHub did not accept that token for this repository." : "Not authorized." }, 401);
}
