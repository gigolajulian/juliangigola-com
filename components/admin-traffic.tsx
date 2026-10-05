"use client";

import * as React from "react";
import { TOKEN_STORE } from "@/lib/admin-github";

/* ── traffic ──────────────────────────────────────────────────────
 * Who came to the site this week and from where, read from Cloudflare by
 * `/api/traffic` with the GitHub token the editor already holds. Pulled when
 * the tab opens and on Refresh, nothing in between.
 *
 * Google's own numbers (searches, impressions, position) live in Search
 * Console; the link is here rather than a copy of them.
 * ─────────────────────────────────────────────────────────────── */

type Row = { n: number; key: string };
type Data = {
  at: string;
  visits: number;
  days: Row[];
  sources: Row[];
  pages: Row[];
  devices: Row[];
  bots: number;
  topBots: Row[];
  google?: Google;
};
type SearchRow = { key: string; clicks: number; impressions: number; position: number };
type Google =
  | { error: string }
  | { clicks: number; impressions: number; position: number | null; queries: SearchRow[]; pages: SearchRow[] };

const SEARCH_CONSOLE =
  "https://search.google.com/u/1/search-console/performance/search-analytics?resource_id=sc-domain%3Ajuliangigola.com";

export function AdminTraffic() {
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const pull = React.useCallback(async () => {
    const token = window.localStorage.getItem(TOKEN_STORE);
    if (!token) return setError("Sign in with the GitHub token first.");
    setBusy(true);
    try {
      const res = await fetch("/api/traffic", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await res.json();
      if (res.ok) {
        setData(body);
        setError("");
      } else setError(body.error ?? "Cloudflare did not answer.");
    } catch {
      setError("Could not reach the site.");
    }
    setBusy(false);
  }, []);
  React.useEffect(() => void pull(), [pull]);

  const sum = (rows: Row[], re: RegExp) =>
    rows.filter((r) => re.test(r.key)).reduce((s, r) => s + r.n, 0);
  const peak = data ? Math.max(1, ...data.days.map((d) => d.n)) : 1;

  const list = (title: string, rows: Row[]) => (
    <div className="border border-border p-4">
      <h3 className="label mb-3 text-muted-foreground">{title}</h3>
      {rows.length ? (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.key} className="flex gap-3 text-sm" title={r.key}>
              <span className="min-w-0 flex-1 truncate">{r.key}</span>
              <span className="tabular-nums text-muted-foreground">{r.n}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">None</p>
      )}
    </div>
  );

  return (
    <div className="mt-10 flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="font-display text-xl uppercase tracking-[0]">
          Traffic
          <span className="label ml-3 text-muted-foreground">
            {data
              ? `last 7 days · pulled ${new Date(data.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
              : "last 7 days"}
          </span>
        </h2>
        <div className="flex gap-2">
          <a
            href={SEARCH_CONSOLE}
            target="_blank"
            rel="noreferrer"
            className="label border border-border px-4 py-2 press hoverable:hover:bg-card"
          >
            Search Console
          </a>
          <button
            type="button"
            onClick={() => void pull()}
            disabled={busy}
            className="label border border-border px-4 py-2 press hoverable:hover:bg-card disabled:opacity-50"
          >
            {busy ? "Pulling…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="label border border-border bg-card px-4 py-3 text-foreground">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Real visits", data.visits],
              ["From Google", sum(data.sources, /google/)],
              ["On phones", `${data.visits ? Math.round((sum(data.devices, /mobile/) / data.visits) * 100) : 0}%`],
              ["Bot hits · 24h", data.bots],
            ].map(([label, value]) => (
              <div key={label} className="border border-border p-4">
                <dt className="label text-muted-foreground">{label}</dt>
                <dd className="mt-2 font-display text-3xl tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-border p-4">
              <h3 className="label mb-3 text-muted-foreground">Visits by day</h3>
              <div className="flex h-16 items-end gap-1.5">
                {data.days.map((d) => (
                  <i
                    key={d.key}
                    title={`${d.key}: ${d.n}`}
                    className="min-h-0.5 flex-1 bg-foreground"
                    style={{ height: `${(d.n / peak) * 100}%` }}
                  />
                ))}
              </div>
              <p className="label mt-2 flex justify-between text-muted-foreground">
                <span>{data.days[0]?.key.slice(5)}</span>
                <span>{data.days.at(-1)?.key.slice(5)}</span>
              </p>
            </div>
            {list("Where from", data.sources)}
            {list("Pages", data.pages)}
            {list("Bots · 24h", data.topBots)}
          </div>

          <GoogleSearch google={data.google} />
        </>
      ) : null}
    </div>
  );
}

/* Google Search over the last 28 days, from Search Console through the
   same route: how often the site showed, how often it was clicked, where it
   ranked, and for what. */
function GoogleSearch({ google }: { google?: Google }) {
  const table = (title: string, rows: SearchRow[]) => (
    <div className="border border-border p-4">
      <h3 className="label mb-3 flex gap-3 text-muted-foreground">
        <span className="flex-1">{title}</span>
        <span>Clicks · shown · rank</span>
      </h3>
      {rows.length ? (
        <ul className="flex flex-col gap-1">
          {rows.map((r) => (
            <li key={r.key} className="flex gap-3 text-sm" title={r.key}>
              <span className="min-w-0 flex-1 truncate">{r.key}</span>
              <span className="tabular-nums text-muted-foreground">
                {r.clicks} · {r.impressions} · {r.position}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          None yet. Google hides searches it has seen only a few times.
        </p>
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-display text-xl uppercase tracking-[0]">
        Google search
        <span className="label ml-3 text-muted-foreground">last 28 days · Search Console</span>
      </h2>
      {!google || "error" in google ? (
        <p className="label border border-border bg-card px-4 py-3 text-foreground">
          {google?.error ?? "Search Console not connected yet."}
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Clicks", google.clicks],
              ["Shown in results", google.impressions],
              ["Click rate", `${google.impressions ? Math.round((google.clicks / google.impressions) * 100) : 0}%`],
              ["Average rank", google.position ?? "–"],
            ].map(([label, value]) => (
              <div key={label} className="border border-border p-4">
                <dt className="label text-muted-foreground">{label}</dt>
                <dd className="mt-2 font-display text-3xl tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="grid gap-3 sm:grid-cols-2">
            {table("Searches", google.queries)}
            {table("Pages", google.pages)}
          </div>
        </>
      )}
    </div>
  );
}
