import { REPO } from "@/lib/admin-github";

/* ── the key the editor already has ───────────────────────────────
 * Whoever can push to the repository publishes the site, so a GitHub token
 * that can push is the site's real credential and the one /admin already
 * holds. A request carrying it as a bearer token is checked against GitHub
 * — does this token see the repository, with push? — and the answer is
 * remembered for five minutes by a hash of it, so a panel's every click is
 * not a round trip.
 *
 * Lifted out of `app/api/inbox/route.ts`, which is where it was written and
 * which still uses it: a route file may only export its handlers, and the
 * avatar route needs the same gate. One copy, so a change to how the site
 * trusts a token is a change in one place.
 * ─────────────────────────────────────────────────────────────── */
const VOUCHED_MS = 5 * 60 * 1000;
const vouched = new Map<string, number>();

export const digest = async (s: string) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

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
  fetch(API + path, {
    ...init,
    signal: AbortSignal.timeout(8000),
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "juliangigola-admin",
    },
  });

async function vouch(token: string): Promise<boolean> {
  const classic = CLASSIC.test(token);
  if (!classic && !FINE.test(token)) return false;
  const id = await digest(token);
  const until = vouched.get(id);
  if (until && until > Date.now()) return true;

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
export async function canPush(token: string): Promise<boolean> {
  try {
    return await vouch(token);
  } catch {
    return false;
  }
}

/** The bearer token on a request, when it carries one. */
export const bearer = (request: Request): string | undefined =>
  /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
