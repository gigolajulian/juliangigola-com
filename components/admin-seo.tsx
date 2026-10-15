"use client";

import * as React from "react";
import { TOKEN_STORE } from "@/lib/admin-github";

/* ── seo ──────────────────────────────────────────────────────────
 * What search and visitors make of each page, from `/api/seo`: totals
 * against the window before, every page by day as a heat map (visits, or
 * Google's clicks or impressions), the searches the site shows for, and
 * where presses land on a page with how far down it gets read.
 *
 * Read-only, pulled when the tab opens and on Refresh, like Traffic.
 * ─────────────────────────────────────────────────────────────── */

type Page = {
  path: string;
  visits: number;
  byDay: number[];
  clicksByDay: number[];
  imprByDay: number[];
  clicks: number;
  impressions: number;
  position: number | null;
};
type Query = { key: string; clicks: number; impressions: number; position: number };
type Google =
  | { error: string }
  | {
      clicks: number;
      impressions: number;
      position: number | null;
      prevClicks: number;
      prevImpressions: number;
      prevPosition: number | null;
      queries: Query[];
      nearPageOne: Query[];
    };
type Data = {
  at: string;
  days: number;
  dates: string[];
  visits: number;
  prevVisits: number;
  pages: Page[];
  sources: { key: string; share: number }[];
  google: Google;
  tracked: { path: string; views: number }[] | { error: string };
};
type ClickMap = {
  path: string;
  views: number;
  clicks: number;
  grid: [number, number, number][];
  targets: [string, number][];
  depth: number[];
};

const SHADES = { visits: "Visits", clicks: "Search clicks", impr: "Impressions" } as const;
type Shade = keyof typeof SHADES;

const btn = "label border border-border px-3 py-2 press hoverable:hover:bg-card disabled:opacity-50";
const seg = (on: boolean) =>
  `label -ml-px border px-3 py-1.5 press first:ml-0 ${on ? "relative border-foreground text-foreground" : "border-border text-muted-foreground"}`;
// One hue, stronger with more: the accent over nothing.
const cell = (t: number) =>
  t <= 0 ? "color-mix(in oklch, var(--foreground) 5%, transparent)" : `color-mix(in oklch, var(--accent) ${Math.round(14 + t * 86)}%, transparent)`;
const fmt = (n: number) => n.toLocaleString("en-US");
const change = (now: number, before: number) =>
  before ? `${now >= before ? "+" : ""}${Math.round(((now - before) / before) * 100)}%` : "new";

async function ask<T>(url: string): Promise<T> {
  const token = window.localStorage.getItem(TOKEN_STORE);
  if (!token) throw new Error("Sign in with the GitHub token first.");
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "The site did not answer.");
  return body;
}

export function AdminSeo() {
  const [days, setDays] = React.useState(28);
  const [data, setData] = React.useState<Data | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [shade, setShade] = React.useState<Shade>("visits");

  const pull = React.useCallback(async (d: number) => {
    setBusy(true);
    try {
      setData(await ask<Data>(`/api/seo?days=${d}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }, []);
  React.useEffect(() => queueMicrotask(() => void pull(days)), [pull, days]);

  const g = data && !("error" in data.google) ? data.google : null;
  const rows = data?.pages ?? [];
  const series = (p: Page) => (shade === "visits" ? p.byDay : shade === "clicks" ? p.clicksByDay : p.imprByDay);
  const peak = Math.max(1, ...rows.flatMap(series));

  return (
    <div className="mt-10 flex flex-col gap-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <h2 className="font-display text-xl uppercase tracking-[0]">
          SEO
          <span className="label ml-3 text-muted-foreground">
            last {days} days · cloudflare + search console
            {data ? ` · pulled ${new Date(data.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}
          </span>
        </h2>
        <div className="flex gap-3">
          <div className="flex" role="group" aria-label="Range">
            {[7, 28, 90].map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={seg(days === d)}>
                {d}d
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void pull(days)} disabled={busy} className={btn}>
            {busy ? "Pulling…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? <p className="label border border-border bg-card px-4 py-3 text-foreground">{error}</p> : null}

      {data ? (
        <>
          <dl className="grid grid-cols-2 border border-border sm:grid-cols-5">
            {[
              ["Visits", fmt(data.visits), change(data.visits, data.prevVisits)],
              ["Search clicks", g ? fmt(g.clicks) : "–", g ? change(g.clicks, g.prevClicks) : ""],
              ["Impressions", g ? fmt(g.impressions) : "–", g ? change(g.impressions, g.prevImpressions) : ""],
              ["CTR", g && g.impressions ? `${((g.clicks / g.impressions) * 100).toFixed(1)}%` : "–", ""],
              [
                "Avg position",
                g?.position ?? "–",
                g?.position && g.prevPosition ? `${g.position <= g.prevPosition ? "up" : "down"} ${Math.abs(g.prevPosition - g.position).toFixed(1)}` : "",
              ],
            ].map(([label, value, delta]) => (
              <div key={label} className="border-border p-4 max-sm:border-t sm:border-l sm:first:border-l-0">
                <dt className="label text-muted-foreground">{label}</dt>
                <dd className="mt-2 font-display text-3xl tabular-nums">{value}</dd>
                <dd className="label mt-1 text-muted-foreground">{delta ? `${delta} vs the ${days} days before` : " "}</dd>
              </div>
            ))}
          </dl>
          {"error" in data.google ? (
            <p className="label border border-border px-4 py-3 text-muted-foreground">Google: {data.google.error}</p>
          ) : null}

          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-lg uppercase tracking-[0]">Pages by day</h3>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex" role="group" aria-label="Shade by">
                  {(Object.keys(SHADES) as Shade[]).map((s) => (
                    <button key={s} type="button" aria-pressed={shade === s} onClick={() => setShade(s)} className={seg(shade === s)}>
                      {SHADES[s]}
                    </button>
                  ))}
                </div>
                <span className="label flex items-center gap-2 text-muted-foreground" aria-hidden>
                  0
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                    <i key={t} className="size-3" style={{ background: cell(t) }} />
                  ))}
                  {peak}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse tabular-nums">
                <thead>
                  <tr className="label text-muted-foreground">
                    <th className="pb-2 pr-4 text-left font-normal">Page</th>
                    <th className="pb-2 text-left font-normal">
                      <span className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${data.dates.length}, 1fr)` }}>
                        {data.dates.map((d, i) => (
                          <span key={d} className="overflow-visible whitespace-nowrap text-[10px]">
                            {i % (data.days > 28 ? 14 : 7) === 0 ? d.slice(5) : ""}
                          </span>
                        ))}
                      </span>
                    </th>
                    {["Visits", "Clicks", "Impr", "CTR", "Pos"].map((h) => (
                      <th key={h} className="px-2 pb-2 text-right font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.path} className="border-t border-border">
                      <td className="max-w-56 truncate py-1.5 pr-4 text-sm" title={p.path}>
                        {p.path}
                      </td>
                      <td className="w-full py-1.5">
                        <span className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${data.dates.length}, 1fr)` }}>
                          {series(p).map((v, i) => (
                            <i
                              key={i}
                              title={`${p.path} · ${data.dates[i]} · ${v} ${SHADES[shade].toLowerCase()}`}
                              className="h-5"
                              style={{ background: cell(v / peak) }}
                            />
                          ))}
                        </span>
                      </td>
                      <td className="px-2 text-right text-sm">{fmt(p.visits)}</td>
                      <td className="px-2 text-right text-sm">{p.clicks}</td>
                      <td className="px-2 text-right text-sm text-muted-foreground">{fmt(p.impressions)}</td>
                      <td className="px-2 text-right text-sm text-muted-foreground">
                        {p.impressions ? `${((p.clicks / p.impressions) * 100).toFixed(1)}%` : "–"}
                      </td>
                      <td className="px-2 text-right text-sm">{p.position ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shade !== "visits" ? (
              <p className="label text-muted-foreground">Google runs about three days behind, so the last days stay empty.</p>
            ) : null}
          </section>

          <ClickMapBlock tracked={data.tracked} />

          <div className="grid gap-6 lg:grid-cols-3">
            <List title="Top searches · clicks · position" rows={g?.queries.map((q) => [q.key, `${q.clicks} · ${q.position}`]) ?? []} />
            <List title="Close to page one" rows={g?.nearPageOne.map((q) => [q.key, `pos ${q.position}`]) ?? []} />
            <List title="Where visits come from" rows={data.sources.map((s) => [s.key, `${Math.round(s.share * 100)}%`])} />
          </div>
        </>
      ) : null}
    </div>
  );
}

function List({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="border border-border">
      <h3 className="label border-b border-border px-4 py-3 text-muted-foreground">{title}</h3>
      {rows.length ? (
        <ul>
          {rows.map(([k, v]) => (
            <li key={k} className="flex gap-3 border-b border-border px-4 py-2 text-sm last:border-b-0" title={k}>
              <span className="min-w-0 flex-1 truncate">{k}</span>
              <span className="tabular-nums text-muted-foreground">{v}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">None yet</p>
      )}
    </div>
  );
}

/* The page itself, live in a frame at 1440 x 900 and scaled to fit, with
   the presses over it and the share of views that got 25/50/75/100% down
   the page beside it. The frame's own beacon stays off (`click-beacon`). */
function ClickMapBlock({ tracked }: { tracked: Data["tracked"] }) {
  const paths = "error" in tracked ? [] : tracked;
  const [path, setPath] = React.useState("");
  const [map, setMap] = React.useState<ClickMap | null>(null);
  const [error, setError] = React.useState("");
  const [width, setWidth] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const current = path || paths[0]?.path || "";

  React.useEffect(() => {
    if (!current) return;
    let live = true;
    ask<ClickMap>(`/api/seo?map=${encodeURIComponent(current)}`)
      .then((m) => live && (setMap(m), setError("")))
      .catch((e: Error) => live && setError(e.message));
    return () => void (live = false);
  }, [current]);

  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [current]);

  // Each 48 x 30 cell a soft spot, stronger with more presses.
  React.useEffect(() => {
    const c = canvas.current;
    if (!c || !map || !width) return;
    const w = (c.width = width);
    const h = (c.height = (width * 900) / 1440);
    const ctx = c.getContext("2d")!;
    const accent = getComputedStyle(c).getPropertyValue("--accent");
    const top = Math.max(1, ...map.grid.filter(([, y]) => y < 30).map(([, , n]) => n));
    ctx.clearRect(0, 0, w, h);
    for (const [x, y, n] of map.grid) {
      if (y >= 30) continue;
      const cx = ((x + 0.5) / 48) * w, cy = ((y + 0.5) / 30) * h, r = w / 24;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, `color-mix(in oklch, ${accent} ${Math.round(25 + (n / top) * 75)}%, transparent)`);
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }, [map, width]);

  const src = current ? current.replace(/^([^#]*)/, "$1?intro=0") : "";
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-lg uppercase tracking-[0]">Clicks and scroll</h3>
        <div className="flex flex-wrap" role="group" aria-label="Page">
          {paths.slice(0, 8).map((p) => (
            <button key={p.path} type="button" aria-pressed={current === p.path} onClick={() => setPath(p.path)} className={seg(current === p.path)}>
              {p.path}
            </button>
          ))}
        </div>
      </div>
      {"error" in tracked || error ? (
        <p className="label border border-border px-4 py-3 text-muted-foreground">
          {"error" in tracked ? tracked.error : error} Desktop presses show up here once the beacon has run for a while.
        </p>
      ) : null}
      {current ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex border border-border">
            <div ref={box} className="relative min-w-0 flex-1 overflow-hidden" style={{ height: (width * 900) / 1440 || undefined }}>
              <iframe
                key={src}
                src={src}
                title={`${current} at 1440 by 900`}
                tabIndex={-1}
                className="pointer-events-none absolute left-0 top-0 origin-top-left opacity-50 grayscale"
                style={{ width: 1440, height: 900, transform: `scale(${width / 1440})` }}
              />
              <canvas ref={canvas} className="absolute inset-0 size-full" aria-label={`Where presses land on ${current}`} />
            </div>
            <ol className="label relative w-12 shrink-0 border-l border-border text-center text-muted-foreground" aria-label="Share of views that got this far down">
              {(map?.depth ?? [0, 0, 0, 0]).map((d, i) => (
                <li key={i} className="absolute inset-x-0 border-t border-border pt-1" style={{ top: `${i * 25}%` }}>
                  {Math.round(d * 100)}%
                </li>
              ))}
            </ol>
          </div>
          <div className="border border-border">
            <h4 className="label border-b border-border px-4 py-3 text-muted-foreground">
              Most pressed · {map ? `${fmt(map.clicks)} presses, ${fmt(map.views)} views` : "…"}
            </h4>
            <ol>
              {(map?.targets ?? []).map(([label, n]) => (
                <li key={label} className="flex gap-3 border-b border-border px-4 py-2 text-sm last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{label}</span>
                    <i className="mt-1 block h-px" style={{ width: `${(n / (map!.targets[0][1] || 1)) * 100}%`, background: "var(--accent)" }} />
                  </span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </section>
  );
}
