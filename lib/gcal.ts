/* ── hello@'s Google Calendar, for the site's own booking engine ─────
 * Julian (2026-11-03): the site books in place of Cal.com
 * (PLAN-own-booking.md). It reads and writes hello@'s calendar through one
 * Workspace OAuth client, Internal, consented once as hello@
 * (`node scripts/gsc-auth.mjs <client.json> cal`). The refresh token lives
 * only in the Worker secret `GCAL_OAUTH`; it is swapped for an access token
 * that is kept in this isolate until five minutes before Google expires it.
 * Nothing here logs a token or a secret, only Google's error codes.
 * ─────────────────────────────────────────────────────────────── */

const TOKEN = "https://oauth2.googleapis.com/token";
export const CALENDAR = "https://www.googleapis.com/calendar/v3";

let cached: { token: string; until: number } | undefined;

/** Forgets the access token, so the next call asks Google again (tests, a 401). */
export const forgetToken = () => void (cached = undefined);

/** An access token for hello@'s calendar. Throws while `GCAL_OAUTH` is unset or refused. */
export async function gcalToken(secret: string | undefined, now = Date.now()): Promise<string> {
  if (cached && now < cached.until) return cached.token;
  if (!secret) throw new Error("GCAL_OAUTH is not set");
  let parsed: { [k: string]: string };
  try {
    parsed = JSON.parse(secret);
  } catch {
    // JSON.parse quotes the text it chokes on: never let a secret reach a log.
    throw new Error("GCAL_OAUTH is not valid JSON");
  }
  const { client_id, client_secret, refresh_token } = parsed;
  const res = await fetch(TOKEN, {
    method: "POST",
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
    signal: AbortSignal.timeout(8000),
  });
  const tok = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  // `error` is a code such as invalid_grant: safe to log, never the token.
  if (!tok.access_token) throw new Error(`Google token refused: ${tok.error ?? res.status}`);
  cached = { token: tok.access_token, until: now + Math.max(60, (tok.expires_in ?? 3600) - 300) * 1000 };
  return tok.access_token;
}

/** A Google API call as hello@: a Calendar path, or a full URL (Gmail). JSON in, JSON out; a non-2xx throws with Google's status. */
export async function gcal<T = { [k: string]: unknown }>(secret: string | undefined, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const call = async () =>
    fetch(path.startsWith("https:") ? path : `${CALENDAR}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { authorization: `Bearer ${await gcalToken(secret)}`, "content-type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(8000),
    });
  let res = await call();
  // A token revoked or expired early: once more with a fresh one.
  if (res.status === 401) {
    forgetToken();
    res = await call();
  }
  if (res.status === 204) return {} as T;
  const out = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Google ${path.split("?")[0]} ${res.status}: ${out.error?.message ?? ""}`.trim());
  return out;
}
