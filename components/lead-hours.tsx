"use client";

import * as React from "react";
import { credentials, KEY_STORE } from "@/lib/admin-github";
import type { Hours, Window } from "@/lib/booking-rules";

/* ── Hours, in the lead desk ──────────────────────────────────────
 * Julian (2026-11-04): change when people can book without a deploy.
 * The week (first and last start per day), then single dates that differ:
 * open a day off, or close a day. Saved to `/api/booking/hours`; the
 * picker and every booking read it at once.
 * ─────────────────────────────────────────────────────────────── */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** 6 AM to 10 PM, every half hour. */
const TIMES = Array.from({ length: 33 }, (_, i) => 360 + i * 30);
const clock = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${m < 720 ? "AM" : "PM"}`;
const DEFAULT_WINDOW: Window = [600, 1140];
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const dateLabel = (d: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(`${d}T00:00:00Z`));

const field = "min-h-11 rounded-[8px] border border-border bg-transparent px-2.5 font-mono text-[13px] focus-visible:outline-2 focus-visible:outline-accent";

function Times({ w, set, label }: { w: Window; set: (w: Window) => void; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <select aria-label={`${label}, first start`} className={field} value={w[0]} onChange={(e) => set([+e.target.value, Math.max(+e.target.value, w[1])])}>
        {TIMES.map((t) => <option key={t} value={t}>{clock(t)}</option>)}
      </select>
      <span className="font-mono text-[12px] text-muted-foreground">to</span>
      <select aria-label={`${label}, last start`} className={field} value={w[1]} onChange={(e) => set([Math.min(w[0], +e.target.value), +e.target.value])}>
        {TIMES.map((t) => <option key={t} value={t}>{clock(t)}</option>)}
      </select>
    </span>
  );
}

function Day({ label, w, set }: { label: string; w: Window | null; set: (w: Window | null) => void }) {
  return (
    <li className="flex min-h-[56px] flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border py-2">
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" checked={!!w} onChange={(e) => set(e.target.checked ? DEFAULT_WINDOW : null)} className="size-5 accent-[var(--accent)]" />
        <span className="sm:hidden">{label.slice(0, 3)}</span>
        <span className="max-sm:hidden">{label}</span>
      </label>
      {w ? <Times w={w} set={set} label={label} /> : <span className="font-mono text-[13px] text-muted-foreground">Closed</span>}
    </li>
  );
}

export function LeadHours() {
  const [hours, setHours] = React.useState<Hours | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [pick, setPick] = React.useState("");

  const call = React.useCallback(async (init?: RequestInit) => {
    const res = await fetch("/api/booking/hours", {
      ...init,
      headers: { ...credentials(window.localStorage.getItem(KEY_STORE) ?? ""), "content-type": "application/json" },
    });
    const body = (await res.json().catch(() => ({}))) as { hours?: Hours; error?: string };
    if (!res.ok || !body.hours) throw new Error(body.error ?? "Could not reach the booking lock.");
    return body.hours;
  }, []);

  React.useEffect(() => {
    call().then(setHours, (e) => setNote(String(e.message)));
  }, [call]);

  if (!hours) return <p className="px-1 py-6 font-mono text-[13px] text-muted-foreground lg:px-5">{note || "Loading hours"}</p>;

  const edit = (h: Hours) => { setHours(h); setNote("Not saved"); };
  const days = Object.entries(hours.days ?? {}).filter(([d]) => d >= today()).sort();
  const save = async () => {
    setBusy(true);
    try {
      setHours(await call({ method: "PUT", body: JSON.stringify(hours) }));
      setNote("Saved. The booking page uses it now.");
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 px-1 py-4 lg:px-5">
      <section className="grid gap-1">
        <h3 className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">Every week, Pacific</h3>
        <ul>
          {[3, 4, 5, 6, 0, 1, 2].map((i) => (
            <Day key={i} label={DAYS[i]} w={hours.week[i]} set={(w) => edit({ ...hours, week: hours.week.map((x, j) => (j === i ? w : x)) })} />
          ))}
        </ul>
      </section>

      <section className="grid gap-1">
        <h3 className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">Single dates</h3>
        <ul>
          {days.map(([d, w]) => (
            <li key={d} className="grid gap-1 border-b border-border py-2">
              <span className="flex min-h-11 items-center justify-between gap-3">
                <span className="text-[15px]">{dateLabel(d)}{w ? null : <span className="ml-3 font-mono text-[13px] text-muted-foreground">Closed</span>}</span>
                <span className="flex items-center">
                <button type="button" className="min-h-11 px-2 font-mono text-[12.5px] text-accent" onClick={() => edit({ ...hours, days: { ...hours.days, [d]: w ? null : DEFAULT_WINDOW } })}>
                  {w ? "Close" : "Open"}
                </button>
                <button type="button" aria-label={`Back to the week on ${dateLabel(d)}`} className="min-h-11 px-2 font-mono text-[12.5px] text-muted-foreground" onClick={() => {
                  edit({ ...hours, days: Object.fromEntries(days.filter(([x]) => x !== d)) });
                }}>
                  Reset
                </button>
                </span>
              </span>
              {w ? <Times w={w} set={(x) => edit({ ...hours, days: { ...hours.days, [d]: x } })} label={dateLabel(d)} /> : null}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <input type="date" aria-label="A date to change" min={today()} value={pick} onChange={(e) => setPick(e.target.value)} className={field} />
          <button
            type="button"
            disabled={!pick}
            className="min-h-11 rounded-[8px] border border-border px-3.5 font-mono text-[12.5px] disabled:opacity-40"
            onClick={() => {
              const w = hours.week[new Date(`${pick}T00:00:00Z`).getUTCDay()];
              edit({ ...hours, days: { ...hours.days, [pick]: w ? null : DEFAULT_WINDOW } });
              setPick("");
            }}
          >
            Change this date
          </button>
        </div>
        <p className="font-mono text-[12px] text-muted-foreground">A day you work turns closed; a day off opens 10 AM to 7 PM. Adjust after.</p>
      </section>

      <div className="flex items-center gap-4">
        <button type="button" disabled={busy || note !== "Not saved"} onClick={save} className="min-h-11 rounded-[8px] bg-accent px-5 font-mono text-[13px] text-background disabled:opacity-40">
          {busy ? "Saving" : "Save hours"}
        </button>
        <p role="status" className="font-mono text-[12.5px] text-muted-foreground">{note}</p>
      </div>
    </div>
  );
}
