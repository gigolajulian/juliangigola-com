/* ── hello@'s Google APIs: the booking engine's calendar, the lead desk's Gmail and Sheet ──
 * It reads and writes hello@'s calendar through one
 * Workspace OAuth client, Internal, consented once as hello@
 * (`node scripts/gsc-auth.mjs <client.json> cal`). The refresh token lives
 * only in the Worker secret `GCAL_OAUTH`; it is swapped for an access token
 * that is kept in this isolate until five minutes before Google expires it.
 * Nothing here logs a token or a secret, only Google's error codes.
 * ─────────────────────────────────────────────────────────────── */
import { secretJson } from "@/lib/secrets";
import { HttpError } from "@/lib/http";
import { outbound } from "@/lib/net";

const TOKEN = "https://oauth2.googleapis.com/token";
export const CALENDAR = "https://www.googleapis.com/calendar/v3";

/** Access tokens by the secret they were swapped from, so one secret's token never answers for another. */
const cached = new Map<string, { token: string; until: number }>();

/** Forgets the access token for `secret`, or every one when none is given, so the next call asks Google again (a 401, tests). */
export const forgetToken = (secret?: string) => {
  if (secret === undefined) cached.clear();
  else cached.delete(secret);
};

/** An access token for hello@'s calendar. Throws while `GCAL_OAUTH` is unset or refused. */
export async function gcalToken(secret: string | undefined, now = Date.now()): Promise<string> {
  if (!secret) throw new Error("GCAL_OAUTH is not set");
  const held = cached.get(secret);
  if (held && now < held.until) return held.token;
  const { client_id, client_secret, refresh_token } = secretJson<{ [k: string]: string }>(secret, "GCAL_OAUTH");
  const res = await outbound(TOKEN, {
    method: "POST",
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
  });
  const tok = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  // `error` is a code such as invalid_grant: safe to log, never the token.
  if (!tok.access_token) throw new Error(`Google token refused: ${tok.error ?? res.status}`);
  cached.set(secret, { token: tok.access_token, until: now + Math.max(60, (tok.expires_in ?? 3600) - 300) * 1000 });
  return tok.access_token;
}

/** A Google API call as hello@: a Calendar path, or a full URL (Gmail). JSON in, JSON out; a non-2xx throws with Google's status. */
export async function gcal<T = { [k: string]: unknown }>(
  secret: string | undefined,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const call = async () =>
    outbound(path.startsWith("https:") ? path : `${CALENDAR}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { authorization: `Bearer ${await gcalToken(secret)}`, "content-type": "application/json" },
      body: init.body ? JSON.stringify(init.body) : undefined,
      });
  let res = await call();
  // A token revoked or expired early: once more with a fresh one.
  if (res.status === 401) {
    if (secret) forgetToken(secret);
    res = await call();
  }
  if (res.status === 204) return {} as T;
  const out = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new HttpError(`Google ${path.split("?")[0]} ${res.status}: ${out.error?.message ?? ""}`.trim(), res.status);
  return out;
}
