import { getCloudflareContext } from "@opennextjs/cloudflare";
import { bearer, canPush } from "@/lib/vouch";

/* ── traffic ──────────────────────────────────────────────────────
 * The numbers behind /admin's Traffic tab, from Cloudflare's own analytics:
 * real visits (Web Analytics, which only counts pages that ran in a
 * browser) and, for the last day, how many page requests were bots.
 *
 * Behind the same gate as the rest of /admin: a GitHub token that can push.
 * The Cloudflare token stays on the Worker (`CF_ANALYTICS_TOKEN`) and only
 * ever reads analytics.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const ZONE = "3637b65119d9b2ce278f9c59c4077ace";
const ACCOUNT = "7fa0ed7addeb11b728e3b935630a1015";
const SITE = "juliangigola.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "cache-control": "no-store", "content-type": "application/json" },
  });

type Row = { n: number; key: string };

export async function GET(request: Request) {
  const token = bearer(request);
  if (!token || !(await canPush(token))) return json({ error: "Not authorised." }, 401);
  const { env } = await getCloudflareContext({ async: true });
  // Held in a const: the check above does not narrow `env` inside `gql`,
  // which failed the production type check (2026-10-05).
  const key = env.CF_ANALYTICS_TOKEN;
  if (!key) return json({ error: "No CF_ANALYTICS_TOKEN on this Worker yet." }, 503);

  const gql = async (query: string) => {
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
    let r: { data?: { viewer: any }; errors?: { message: string }[] };
    try {
      r = JSON.parse(text);
    } catch {
      // The key's length, never the key: a paste that went wrong shows as a
      // length far from the 40 characters a Cloudflare token has.
      throw new Error(
        `Cloudflare answered ${res.status}: ${text.slice(0, 160) || "(empty)"} (key is ${env.CF_ANALYTICS_TOKEN!.trim().length} characters)`,
      );
    }
    if (r.errors?.length || !r.data) throw new Error(r.errors?.[0]?.message ?? "Cloudflare said no.");
    return r.data.viewer;
  };
  const now = new Date();
  const ago = (days: number) => new Date(now.getTime() - days * 864e5).toISOString();

  /* Headless Chrome is the automated test runs on Julian's PC, so it is
     left out of the visits. */
  const rum = async (dim: string, limit = 12): Promise<Row[]> => {
    const v = await gql(
      `{viewer{accounts(filter:{accountTag:"${ACCOUNT}"}){rumPageloadEventsAdaptiveGroups(limit:${limit},filter:{datetime_geq:"${ago(7)}",datetime_lt:"${now.toISOString()}",userAgentBrowser_neq:"ChromeHeadless"},orderBy:[sum_visits_DESC]){sum{visits} dimensions{${dim}}}}}}`,
    );
    return v.accounts[0].rumPageloadEventsAdaptiveGroups.map(
      (g: { sum: { visits: number }; dimensions: Record<string, string> }) => ({
        n: g.sum.visits,
        key: Object.values(g.dimensions).join(" "),
      }),
    );
  };

  try {
    const [days, sources, pages, devices, zone, google] = await Promise.all([
      rum("date", 8),
      rum("refererHost"),
      rum("requestPath", 10),
      rum("deviceType", 4),
      gql(
        `{viewer{zones(filter:{zoneTag:"${ZONE}"}){httpRequestsAdaptiveGroups(limit:500,filter:{datetime_geq:"${ago(1)}",datetime_lt:"${now.toISOString()}",requestSource:"eyeball",edgeResponseContentTypeName:"html"},orderBy:[count_DESC]){count dimensions{userAgent}}}}}`,
      ),
      searchConsole(env.GSC_OAUTH),
    ]);

    const botLike = /bot|crawl|spider|curl|wget|python|headless|go-http|node|axios|fetch|extended|agent|preview|scan|^$/i;
    let bots = 0;
    const topBots: Row[] = [];
    for (const a of zone.zones[0].httpRequestsAdaptiveGroups as { count: number; dimensions: { userAgent: string } }[]) {
      const ua = a.dimensions.userAgent;
      if (!botLike.test(ua)) continue;
      bots += a.count;
      topBots.push({ n: a.count, key: ua.match(/([A-Za-z-]*(?:bot|Agent|Extended|curl|HeadlessChrome)[\w./-]*)/i)?.[1] ?? (ua || "(no user agent)") });
    }

    return json({
      at: now.toISOString(),
      visits: days.reduce((s, d) => s + d.n, 0),
      days: days.sort((a, b) => a.key.localeCompare(b.key)),
      sources: sources.filter((s) => s.key !== SITE).map((s) => ({ ...s, key: s.key || "direct / Instagram app" })),
      pages: pages.filter((p) => p.n > 0),
      devices,
      bots,
      topBots: topBots.slice(0, 6),
      google,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}

/* Google Search, last 28 days, from Search Console. `GSC_OAUTH` is
   `{client_id, client_secret, refresh_token}` for hello@, read-only
   (webmasters.readonly), made once by `scripts/gsc-auth.mjs`. Its own
   failure is reported in its own block, so Cloudflare's numbers still show. */
async function searchConsole(secret?: string) {
  if (!secret) return { error: "Search Console not connected yet." };
  try {
    const { client_id, client_secret, refresh_token } = JSON.parse(secret);
    const tok = (await (
      await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" }),
      })
    ).json()) as { access_token?: string; error_description?: string; error?: string };
    if (!tok.access_token) return { error: `Google sign-in failed: ${tok.error_description ?? tok.error}` };

    // Search Console is about three days behind, so the window ends there.
    const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const query = async (dimensions: string[], rowLimit = 10) => {
      const res = await fetch(
        "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Ajuliangigola.com/searchAnalytics/query",
        {
          method: "POST",
          headers: { authorization: `Bearer ${tok.access_token}`, "content-type": "application/json" },
          body: JSON.stringify({ startDate: day(30), endDate: day(2), dimensions, rowLimit }),
        },
      );
      const r = (await res.json()) as {
        rows?: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
        error?: { message: string };
      };
      if (r.error) throw new Error(r.error.message);
      return r.rows ?? [];
    };
    const [total, queries, pages] = await Promise.all([query([]), query(["query"]), query(["page"])]);
    const t = total[0];
    const rows = (list: typeof queries) =>
      list.map((r) => ({ key: r.keys![0].replace(/^https?:\/\/(www\.)?juliangigola\.com/, "") || "/", clicks: r.clicks, impressions: r.impressions, position: Math.round(r.position * 10) / 10 }));
    return {
      clicks: t?.clicks ?? 0,
      impressions: t?.impressions ?? 0,
      position: t ? Math.round(t.position * 10) / 10 : null,
      queries: rows(queries),
      pages: rows(pages),
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
