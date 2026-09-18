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
 * The shapes GitHub tokens come in. Anything else is refused before the
 * fetch: otherwise every request with a made-up bearer string costs a call
 * to GitHub, and enough of those from one origin gets the Worker's egress
 * rate-limited there.
 */
const GITHUB_TOKEN =
  /^(gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255})$/;

async function vouch(token: string): Promise<boolean> {
  if (!GITHUB_TOKEN.test(token)) return false;
  const id = await digest(token);
  const until = vouched.get(id);
  if (until && until > Date.now()) return true;

  // Bounded, and closed on failure: a slow GitHub must not hang the gate
  // open, and an unreachable one must not open it.
  const res = await fetch(
    `https://api.github.com/repos/${REPO.owner}/${REPO.repo}`,
    {
      signal: AbortSignal.timeout(8000),
      headers: {
        authorization: `Bearer ${token}`,
        accept: "application/vnd.github+json",
        "user-agent": "juliangigola-admin",
      },
    },
  );
  if (!res.ok) {
    await res.body?.cancel();
    return false;
  }
  const repo = (await res.json()) as { permissions?: { push?: boolean } };
  const ok = repo.permissions?.push === true;
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
