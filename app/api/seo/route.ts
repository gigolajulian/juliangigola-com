import { getCloudflareContext } from "@opennextjs/cloudflare";
import { bearer, canPush } from "@/lib/vouch";
import { ACCOUNT, SITE, cloudflare, engineSql, searchConsole, sitePath } from "@/lib/analytics";
import { BEACON_DATASET } from "@/lib/beacon";

/* ── seo ──────────────────────────────────────────────────────────
 * The numbers behind /admin's SEO tab. Same gate and same two keys as
 * /api/traffic, wider view:
 *
 *   ?days=7|28|90   pages by day (Cloudflare visits, Google clicks and
 *                   impressions), totals against the window before, queries
 *   &map=/path      clicks and scroll depth on one page, from the site's own
 *                   beacon (`lib/beacon.ts`) in Analytics Engine
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "cache-control": "no-store", "content-type": "application/json" },
  });

type Rum = {
  accounts: { rumPageloadEventsAdaptiveGroups: { sum: { visits: number }; dimensions: Record<string, string> }[] }[];
};

const MAX_PAGES = 20;
// Only what the beacon itself would accept, so a path can go into SQL as is.
const PATH = /^\/[\w\-/.#]{0,200}$/;

export async function GET(request: Request) {
  const token = bearer(request);
  if (!token || !(await canPush(token))) return json({ error: "Not authorised." }, 401);
  const { env } = await getCloudflareContext({ async: true });
  const key = env.CF_ANALYTICS_TOKEN;
  if (!key) return json({ error: "No CF_ANALYTICS_TOKEN on this Worker yet." }, 503);

  const url = new URL(request.url);
  const map = url.searchParams.get("map");
  if (map !== null) {
    if (!PATH.test(map)) return json({ error: "Not a page path." }, 400);
    try {
      return json(await clickMap(key, map));
    } catch (e) {
      return json({ error: (e as Error).message }, 502);
    }
  }

  const days = [7, 28, 90].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 28;
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const date = (ms: number) => iso(ms).slice(0, 10);
  const dates = Array.from({ length: days }, (_, i) => date(now - (days - 1 - i) * 864e5));

  const gql = cloudflare(key);
  /* Headless Chrome is the automated test runs on Julian's PC. */
  const rum = async (dims: string, from: number, to: number, limit: number) =>
    (
      await gql<Rum>(
        `{viewer{accounts(filter:{accountTag:"${ACCOUNT}"}){rumPageloadEventsAdaptiveGroups(limit:${limit},filter:{datetime_geq:"${iso(from)}",datetime_lt:"${iso(to)}",userAgentBrowser_neq:"ChromeHeadless"},orderBy:[sum_visits_DESC]){sum{visits} dimensions{${dims}}}}}}`,
      )
    ).accounts[0].rumPageloadEventsAdaptiveGroups;

  const start = now - days * 864e5;
  try {
    const [byPageDay, prior, sources, google, tracked] = await Promise.all([
      rum("requestPath date", start, now, 5000),
      rum("date", start - days * 864e5, start, 100),
      rum("refererHost", start, now, 12),
      searchStats(env.GSC_OAUTH, days),
      engineSql<{ path: string; views: number }>(
        key,
        `SELECT blob1 AS path, SUM(_sample_interval) AS views FROM ${BEACON_DATASET} WHERE blob2 = 'view' AND timestamp > NOW() - INTERVAL '${days}' DAY GROUP BY path ORDER BY views DESC LIMIT 12`,
      ).catch((e: Error) => ({ error: /unknown|not found|does not exist/i.test(e.message) ? "No beacon data yet." : e.message })),
    ]);

    const pages = new Map<string, { path: string; visits: number; byDay: number[]; clicksByDay: number[]; imprByDay: number[]; clicks: number; impressions: number; position: number | null }>();
    const page = (path: string) => {
      let p = pages.get(path);
      if (!p) {
        const zero = () => dates.map(() => 0);
        p = { path, visits: 0, byDay: zero(), clicksByDay: zero(), imprByDay: zero(), clicks: 0, impressions: 0, position: null };
        pages.set(path, p);
      }
      return p;
    };
    for (const g of byPageDay) {
      const p = page(g.dimensions.requestPath || "/");
      p.visits += g.sum.visits;
      const i = dates.indexOf(g.dimensions.date);
      if (i >= 0) p.byDay[i] += g.sum.visits;
    }
    if (!("error" in google)) {
      for (const r of google.pages) Object.assign(page(r.path), { clicks: r.clicks, impressions: r.impressions, position: r.position });
      for (const r of google.pageDays) {
        const i = dates.indexOf(r.date);
        if (i >= 0) {
          page(r.path).clicksByDay[i] += r.clicks;
          page(r.path).imprByDay[i] += r.impressions;
        }
      }
    }
    const visits = byPageDay.reduce((s, g) => s + g.sum.visits, 0);
    const sourceTotal = sources.reduce((s, g) => s + g.sum.visits, 0) || 1;

    return json({
      at: iso(now),
      days,
      dates,
      visits,
      prevVisits: prior.reduce((s, g) => s + g.sum.visits, 0),
      pages: [...pages.values()].sort((a, b) => b.visits - a.visits || b.impressions - a.impressions).slice(0, MAX_PAGES),
      sources: sources.map((g) => ({
        key: g.dimensions.refererHost && g.dimensions.refererHost !== SITE ? g.dimensions.refererHost : "direct / Instagram app",
        share: g.sum.visits / sourceTotal,
      })),
      google,
      tracked,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 502);
  }
}

/* Google over the same window and the one before, by page, by page and day,
   and by query. Search Console runs about three days behind, so its window
   ends there; its days line up with Cloudflare's by date. Its failure is its
   own, so Cloudflare's numbers still show. */
async function searchStats(secret: string | undefined, days: number) {
  if (!secret) return { error: "Search Console not connected yet." };
  try {
    const ask = await searchConsole(secret);
    const day = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const range = { startDate: day(days + 1), endDate: day(2) };
    const prev = { startDate: day(days * 2 + 1), endDate: day(days + 2) };
    const [total, before, pages, pageDays, queries] = await Promise.all([
      ask({ ...range, dimensions: [] }),
      ask({ ...prev, dimensions: [] }),
      ask({ ...range, dimensions: ["page"], rowLimit: 50 }),
      ask({ ...range, dimensions: ["page", "date"], rowLimit: 5000 }),
      ask({ ...range, dimensions: ["query"], rowLimit: 200 }),
    ]);
    const round = (n: number) => Math.round(n * 10) / 10;
    const q = queries.map((r) => ({ key: r.keys![0], clicks: r.clicks, impressions: r.impressions, position: round(r.position) }));
    const t = total[0];
    const b = before[0];
    return {
      clicks: t?.clicks ?? 0,
      impressions: t?.impressions ?? 0,
      position: t ? round(t.position) : null,
      prevClicks: b?.clicks ?? 0,
      prevImpressions: b?.impressions ?? 0,
      prevPosition: b ? round(b.position) : null,
      pages: pages.map((r) => ({ path: sitePath(r.keys![0]), clicks: r.clicks, impressions: r.impressions, position: round(r.position) })),
      pageDays: pageDays.map((r) => ({ path: sitePath(r.keys![0]), date: r.keys![1], clicks: r.clicks, impressions: r.impressions })),
      queries: q.slice(0, 8),
      // Just off page one: where a little work moves the most.
      nearPageOne: q.filter((r) => r.position > 10 && r.position <= 20).sort((x, y) => y.impressions - x.impressions).slice(0, 6),
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/* One page's clicks on a desktop window, as a 48 x 30 grid of counts over
   the viewport, the controls clicked most, and how far down the page views
   got. Desktop only, so every point lands on the same 16:10 frame the
   overlay shows; phones and tablets lay the page out differently. */
async function clickMap(key: string, path: string) {
  const where = `blob1 = '${path}' AND blob4 = 'desktop' AND timestamp > NOW() - INTERVAL '28' DAY`;
  const [grid, targets, depth] = await Promise.all([
    engineSql<{ gx: number; gy: number; n: number }>(
      key,
      `SELECT floor(double1 * 48) AS gx, floor(double2 * 30) AS gy, SUM(_sample_interval) AS n FROM ${BEACON_DATASET} WHERE ${where} AND blob2 = 'click' GROUP BY gx, gy`,
    ),
    engineSql<{ label: string; n: number }>(
      key,
      `SELECT blob3 AS label, SUM(_sample_interval) AS n FROM ${BEACON_DATASET} WHERE ${where} AND blob2 = 'click' AND blob3 != '' GROUP BY label ORDER BY n DESC LIMIT 8`,
    ),
    engineSql<{ views: number; d25: number; d50: number; d75: number; d100: number }>(
      key,
      `SELECT SUM(_sample_interval) AS views, SUM(IF(double3 >= 0.25, _sample_interval, 0)) AS d25, SUM(IF(double3 >= 0.5, _sample_interval, 0)) AS d50, SUM(IF(double3 >= 0.75, _sample_interval, 0)) AS d75, SUM(IF(double3 >= 0.98, _sample_interval, 0)) AS d100 FROM ${BEACON_DATASET} WHERE ${where} AND blob2 = 'view'`,
    ),
  ]);
  const d = depth[0] ?? { views: 0, d25: 0, d50: 0, d75: 0, d100: 0 };
  const views = Number(d.views) || 0;
  const share = (n: number) => (views ? Number(n) / views : 0);
  return {
    path,
    views,
    clicks: grid.reduce((s, c) => s + Number(c.n), 0),
    grid: grid.map((c) => [Number(c.gx), Number(c.gy), Number(c.n)]),
    targets: targets.map((t) => [t.label, Number(t.n)]),
    depth: [share(d.d25), share(d.d50), share(d.d75), share(d.d100)],
  };
}
