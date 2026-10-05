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
  if (!env.CF_ANALYTICS_TOKEN)
    return json({ error: "No CF_ANALYTICS_TOKEN on this Worker yet." }, 503);

  const gql = async (query: string) => {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const text = await res.text();
    let r: { data?: { viewer: any }; errors?: { message: string }[] };
    try {
      r = JSON.parse(text);
    } catch {
      throw new Error(`Cloudflare answered ${res.status}: ${text.slice(0, 160) || "(empty)"}`);
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
    const [days, sources, pages, devices, zone] = await Promise.all([
      rum("date", 8),
      rum("refererHost"),
      rum("requestPath", 10),
      rum("deviceType", 4),
      gql(
        `{viewer{zones(filter:{zoneTag:"${ZONE}"}){httpRequestsAdaptiveGroups(limit:500,filter:{datetime_geq:"${ago(1)}",datetime_lt:"${now.toISOString()}",requestSource:"eyeball",edgeResponseContentTypeName:"html"},orderBy:[count_DESC]){count dimensions{userAgent}}}}}`,
      ),
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
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}
