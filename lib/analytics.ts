/* ── analytics ────────────────────────────────────────────────────
 * The two read-only doors /admin's Traffic and SEO tabs share: Cloudflare's
 * GraphQL (and its Analytics Engine SQL, same token) and Google Search
 * Console. Both keys stay on the Worker; nothing here returns them.
 * ─────────────────────────────────────────────────────────────── */

export const ZONE = "3637b65119d9b2ce278f9c59c4077ace";
export const ACCOUNT = "7fa0ed7addeb11b728e3b935630a1015";
export const SITE = "juliangigola.com";

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
      throw new Error(
        `Cloudflare answered ${res.status}: ${text.slice(0, 160) || "(empty)"} (key is ${key.trim().length} characters)`,
      );
    }
    if (r.errors?.length || !r.data) throw new Error(r.errors?.[0]?.message ?? "Cloudflare said no.");
    return r.data.viewer;
  };
}

/** Analytics Engine SQL with the same token (Account Analytics Read covers it). */
export async function engineSql<T>(key: string, sql: string): Promise<T[]> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`, {
    method: "POST",
    headers: { authorization: `Bearer ${key.trim()}`, "user-agent": "juliangigola-admin-seo" },
    body: sql,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Analytics Engine answered ${res.status}: ${text.slice(0, 160)}`);
  return (JSON.parse(text) as { data: T[] }).data;
}

export type SearchRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

/** A Search Console query function for `GSC_OAUTH` (hello@, read-only). */
export async function searchConsole(secret: string) {
  const { client_id, client_secret, refresh_token } = JSON.parse(secret);
  const tok = (await (
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
    })
  ).json()) as { access_token?: string; error_description?: string; error?: string };
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
    const r = (await res.json()) as { rows?: SearchRow[]; error?: { message: string } };
    if (r.error) throw new Error(r.error.message);
    return r.rows ?? [];
  };
}

/** Search Console's page URL as a site path: `https://juliangigola.com/x` -> `/x`. */
export const sitePath = (url: string) =>
  url.replace(/^https?:\/\//, "").replace(/^(www\.)?juliangigola\.com(?=\/|$)/, "") || "/";
