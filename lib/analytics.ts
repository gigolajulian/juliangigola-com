/* ── analytics ────────────────────────────────────────────────────
 * The two read-only doors /admin's Traffic and SEO tabs share: Cloudflare's
 * GraphQL (and its Analytics Engine SQL, same token) and Google Search
 * Console. Both keys stay on the Worker; nothing here returns them.
 * ─────────────────────────────────────────────────────────────── */
import { secretJson } from "@/lib/secrets";
import { HttpError } from "@/lib/http";

export const ZONE = "3637b65119d9b2ce278f9c59c4077ace";
export const ACCOUNT = "7fa0ed7addeb11b728e3b935630a1015";
export const SITE_HOST = "juliangigola.com";

/** A GraphQL caller for `CF_ANALYTICS_TOKEN`. Throws Cloudflare's own message. */
export function cloudflare(key: string) {
  return async <T>(query: string): Promise<T> => {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      // Trimmed, since a pasted secret can carry a newline; and a user agent,
      // because the API answers an anonymous Worker request with an empty 400.
      headers: {
        authorization: `Bearer ${key.trim()}`,
        "content-type": "application/json",
        "user-agent": "juliangigola-admin-traffic",
      },
      body: JSON.stringify({ query }),
    });
    const text = await res.text();
    let r: { data?: { viewer: T }; errors?: { message: string }[] };
    try {
      r = JSON.parse(text);
    } catch {
      // The key's length, never the key: a paste that went wrong shows as a
      // length far from the 40 characters a Cloudflare token has.
      throw new HttpError(
        `Cloudflare answered ${res.status}: ${text.slice(0, 160) || "(empty)"} (key is ${key.trim().length} characters)`,
        res.status,
      );
    }
    if (r.errors?.length || !r.data) throw new Error(r.errors?.[0]?.message ?? "Cloudflare said no.");
    return r.data.viewer;
  };
}

/** One Web Analytics row: its visits and the dimensions asked for. */
export type RumGroup = { sum: { visits: number }; dimensions: Record<string, string> };

/**
 * Web Analytics visits between two ISO times, grouped by `dims` (space-separated
 * field names), most first. Headless Chrome is the automated test runs on
 * Julian's PC, so it is left out.
 */
export async function rumVisits(key: string, dims: string, from: string, to: string, limit: number): Promise<RumGroup[]> {
  const v = await cloudflare(key)<{ accounts: { rumPageloadEventsAdaptiveGroups: RumGroup[] }[] }>(
    `{viewer{accounts(filter:{accountTag:"${ACCOUNT}"}){rumPageloadEventsAdaptiveGroups(limit:${limit},filter:{datetime_geq:"${from}",datetime_lt:"${to}",userAgentBrowser_neq:"ChromeHeadless"},orderBy:[sum_visits_DESC]){sum{visits} dimensions{${dims}}}}}}`,
  );
  return v.accounts[0].rumPageloadEventsAdaptiveGroups;
}

/** Analytics Engine SQL with the same token (Account Analytics Read covers it). */
export async function engineSql<T>(key: string, sql: string): Promise<T[]> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`, {
    method: "POST",
    headers: { authorization: `Bearer ${key.trim()}`, "user-agent": "juliangigola-admin-seo" },
    body: sql,
  });
  const text = await res.text();
  if (!res.ok) throw new HttpError(`Analytics Engine answered ${res.status}: ${text.slice(0, 160)}`, res.status);
  try {
    return (JSON.parse(text) as { data: T[] }).data;
  } catch {
    throw new HttpError(`Analytics Engine answered ${res.status}: ${text.slice(0, 160)}`, res.status);
  }
}

export type SearchRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

/** A Search Console query function for `GSC_OAUTH` (hello@, read-only). */
export async function searchConsole(secret: string) {
  const { client_id, client_secret, refresh_token } = secretJson<{ [k: string]: string }>(secret, "GSC_OAUTH");
  const tokRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
  });
  // An HTML error page from Google is a refusal too, not a JSON parse crash.
  const tok = (await tokRes.json().catch(() => ({ error: `HTTP ${tokRes.status}` }))) as { access_token?: string; error_description?: string; error?: string };
  if (!tok.access_token) throw new Error(`Google sign-in failed: ${tok.error_description ?? tok.error}`);

  return async (body: Record<string, unknown>): Promise<SearchRow[]> => {
    const res = await fetch(
      "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Ajuliangigola.com/searchAnalytics/query",
      {
        method: "POST",
        headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const r = (await res.json().catch(() => ({ error: { message: `Search Console said ${res.status}` } }))) as { rows?: SearchRow[]; error?: { message: string } };
    if (r.error) throw new Error(r.error.message);
    return r.rows ?? [];
  };
}

/** Search Console's page URL as a site path: `https://juliangigola.com/x` -> `/x`. */
export const sitePath = (url: string) =>
  url.replace(/^https?:\/\//, "").replace(/^(www\.)?juliangigola\.com(?=\/|$)/, "") || "/";
