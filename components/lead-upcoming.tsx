"use client";

import * as React from "react";
import { credentials, KEY_STORE } from "@/components/admin-inbox";
import { TZ } from "@/lib/booking-rules";
import type { LeadSummary } from "@/lib/leads";
import { cn } from "@/lib/utils";

/* ── Upcoming as a month ──────────────────────────────────────────
 * Julian (2026-11-06): "upcoming page on leads needs to be a calendar view
 * like this, connected to my iphone cal", "swipable". Mock:
 * claude.ai/artifact/DpVcbM8qwDNrV3vsbqPdHj. Cyan dots are leads, grey dots
 * the rest of hello@ (the calendar his iPhone shows), read through
 * `app/api/calendar` like the Calendar screen. A booking's own calendar
 * event is the lead's, so it is not shown twice.
 * ─────────────────────────────────────────────────────────────── */

type Ev = { id: string; title: string; start: string; end: string; allDay: boolean; block: boolean };

const dayOf = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ms);
const time = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(ms);
const MONTH = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
const shift = (m: string, n: number) => {
  const d = new Date(`${m}-15T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const days = (m: string) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
const lastDay = (m: string) => `${m}-${String(days(m)).padStart(2, "0")}`;

async function month(m: string): Promise<Ev[]> {
  const res = await fetch(`/api/calendar?from=${m}-01&to=${lastDay(m)}`, {
    headers: credentials(window.localStorage.getItem(KEY_STORE) ?? ""),
    cache: "no-store",
  });
  const out = (await res.json().catch(() => ({}))) as { events?: Ev[]; busy?: { label: string; start: string; end: string }[]; error?: string };
  if (!res.ok) throw new Error(out.error ?? `Request failed (${res.status})`);
  // The calendars it also reads (iCloud, another account) give busy time only: their label stands in for a title.
  const busy = (out.busy ?? []).map((b, i) => ({ id: `busy${i}-${b.start}`, title: `${b.label}, busy`, start: b.start, end: b.end, allDay: false, block: false }));
  return [...(out.events ?? []), ...busy];
}

type Item = { at: number; end: number; lead?: LeadSummary; ev?: Ev };

export function LeadUpcoming({ leads, row }: { leads: LeadSummary[]; row: (l: LeadSummary) => React.ReactNode }) {
  const [now] = React.useState(() => Date.now());
  const today = dayOf(now);
  const [cur, setCur] = React.useState(today.slice(0, 7));
  const [pick, setPick] = React.useState(today);
  const [cal, setCal] = React.useState<Record<string, Ev[] | "error">>({});
  const box = React.useRef<HTMLDivElement>(null);
  const shown = [shift(cur, -1), cur, shift(cur, 1)];

  React.useEffect(() => {
    for (const m of shown) {
      if (cal[m]) continue;
      month(m).then(
        (evs) => setCal((c) => ({ ...c, [m]: evs })),
        () => setCal((c) => ({ ...c, [m]: "error" })),
      );
    }
  }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps

  // The middle month always sits in view; a swipe that lands on a side one
  // moves the months and puts the view back in the middle.
  React.useLayoutEffect(() => {
    const el = box.current;
    if (el) el.scrollLeft = el.clientWidth;
  }, [cur]);
  const settle = () => {
    const el = box.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i === 1 || Math.abs(el.scrollLeft - i * el.clientWidth) >= 2) return;
    // As on the iPhone: a new month picks its first day, or today in this month.
    const m = shift(cur, i - 1);
    setCur(m);
    setPick(m === today.slice(0, 7) ? today : `${m}-01`);
  };

  const byDay = React.useMemo(() => {
    const out = new Map<string, Item[]>();
    const add = (d: string, it: Item) => out.set(d, [...(out.get(d) ?? []), it]);
    const leadAt = new Set<number>();
    for (const l of leads) {
      if (!l.when) continue;
      const at = Date.parse(l.when);
      leadAt.add(Math.round(at / 6e4));
      add(dayOf(at), { at, end: at, lead: l });
    }
    for (const evs of Object.values(cal)) {
      if (evs === "error") continue;
      for (const ev of evs) {
        const at = Date.parse(ev.start);
        if (leadAt.has(Math.round(at / 6e4))) continue;
        add(ev.allDay ? ev.start.slice(0, 10) : dayOf(at), { at, end: Date.parse(ev.end), ev });
      }
    }
    for (const list of out.values()) list.sort((a, b) => Number(!a.ev?.allDay) - Number(!b.ev?.allDay) || a.at - b.at);
    return out;
  }, [leads, cal]);

  const list = byDay.get(pick) ?? [];
  const failed = shown.some((m) => cal[m] === "error");
  const head = new Date(`${pick}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="grid">
      <div className="flex items-baseline justify-between px-1 pt-3 lg:px-5">
        <p className="text-[22px] font-semibold tracking-[-0.02em]">
          {MONTH(cur)} <span className="font-mono text-[12px] font-normal text-muted-foreground">{cur.slice(0, 4)}</span>
        </p>
        <button
          type="button"
          onClick={() => { setPick(today); setCur(today.slice(0, 7)); }}
          className="min-h-11 rounded-full border border-border px-3.5 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground"
        >
          Today
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-border px-1 pb-1.5 pt-2 text-center font-mono text-[10.5px] tracking-[0.08em] text-muted-foreground lg:px-5" aria-hidden="true">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div ref={box} onScroll={settle} className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shown.map((m) => {
          const lead = (new Date(`${m}-01T12:00:00Z`).getUTCDay() + 6) % 7;
          return (
            <div key={m} role="grid" aria-label={`${MONTH(m)} ${m.slice(0, 4)}`} className="grid w-full flex-none snap-start grid-cols-7 content-start px-1 lg:px-5">
              {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} className="h-[58px] border-t border-border" />)}
              {Array.from({ length: days(m) }, (_, i) => {
                const d = `${m}-${String(i + 1).padStart(2, "0")}`;
                const its = byDay.get(d) ?? [];
                const wk = (lead + i) % 7 > 4;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPick(d)}
                    aria-pressed={d === pick}
                    aria-label={`${d}${its.length ? `, ${its.length} on the calendar` : ""}`}
                    className={cn("flex h-[58px] flex-col items-center gap-1 border-t border-border pt-1.5 text-[18px] font-medium", d < today ? "text-muted-foreground/50" : wk && "text-muted-foreground")}
                  >
                    <span className={cn("grid size-8 place-items-center rounded-full", d === today && "text-accent", d === pick && "bg-foreground text-background")}>{i + 1}</span>
                    <span className="flex h-[5px] gap-[3px]">
                      {its.slice(0, 3).map((it, k) => <i key={k} className={cn("size-[5px] rounded-full", it.lead ? "bg-accent" : "bg-muted-foreground")} />)}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <p className="border-t border-border px-1 pb-1 pt-4 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground lg:px-5">
        {pick === today ? "Today, " : ""}{head}
      </p>
      {failed ? <p className="px-1 pb-2 font-mono text-[12.5px] text-muted-foreground lg:px-5">Could not read the calendar. Leads only.</p> : null}
      {list.length ? (
        <ul>
          {list.map((it) =>
            it.lead ? (
              <li key={`l${it.lead.id}`}>{row(it.lead)}</li>
            ) : (
              <li key={`e${it.ev!.id}`} className="flex gap-3 border-b border-border px-1 py-3.5 lg:px-5">
                <span className="w-[3px] flex-none rounded-full bg-muted-foreground/60" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.01em]">{it.ev!.title}</span>
                <span className="flex-none text-right font-mono text-[12px] leading-snug text-muted-foreground">
                  {it.ev!.allDay ? "All day" : <>{time(it.at)}<br />{time(it.end)}</>}
                </span>
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="px-1 py-8 text-[15px] text-muted-foreground lg:px-5">Nothing on this day.</p>
      )}
    </div>
  );
}
