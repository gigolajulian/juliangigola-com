"use client";

import * as React from "react";
import { credentials, KEY_STORE } from "@/lib/admin-github";
import { EVENTS, HOURS, TZ } from "@/lib/booking/booking-rules";
import { startsFor, zoned } from "@/lib/booking/slots";
import { cn } from "@/lib/utils";

/* ── the Leads app's Calendar ─────────────────────────────────────
 * Julian (2026-11-04): "control the calendar, block off days, and add
 * other calendars to read off of". The month on hello@ (bookings, blocks),
 * the busy time of the calendars it reads, and closed weekdays. Pick a day
 * to block it, a run of days, or hours. Talks to `app/api/calendar`.
 * Its own file so the desk's navigation (`admin-leads.tsx`) only mounts it:
 * a Calendar line in the desktop sidebar, under More on the phone.
 * ─────────────────────────────────────────────────────────────── */

type Ev = { id: string; title: string; start: string; end: string; allDay: boolean; block: boolean; booking: boolean; free: boolean };
type Busy = { label: string; start: string; end: string };
type Extra = { label: string; src: string; ics: boolean; failed: boolean };
type Month = { events: Ev[]; busy: Busy[]; extras: Extra[] };

const HEAD: React.CSSProperties = { fontFamily: "var(--font-display)", textTransform: "none", fontWeight: 600, letterSpacing: "-0.02em", wordSpacing: 0 };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const btn = "inline-flex min-h-11 items-center rounded-[4px] border border-border px-3.5 font-mono text-[12.5px] disabled:opacity-50";
const field = "min-h-11 rounded-[8px] border border-border bg-transparent px-3 text-base placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-accent lg:text-[14px]";

/** `2026-11-19`: the Pacific day an instant falls on. */
const dayOf = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ms);
const ymd = (day: string) => day.split("-").map(Number) as [number, number, number];
const startOf = (day: string) => zoned(...ymd(day), 0);
const plus = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay();
const time = (ms: number) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(ms).replace(":00", "");
const range = (a: number, b: number) => `${time(a)}–${time(b)}`;

/** The days `[start, end)` touches, in Pacific. */
function daysOf(start: string, end: string) {
  const out: string[] = [];
  const last = dayOf(Date.parse(end) - 1);
  for (let d = dayOf(Date.parse(start)); d <= last; d = plus(d, 1)) out.push(d);
  return out;
}

/** The open stretches of `day` within Julian's hours, minus what is busy. */
function openSpans(day: string, busy: { start: number; end: number }[], now: number) {
  const h = HOURS[weekday(day)];
  if (!h) return [];
  let spans = [[zoned(...ymd(day), h[0]), zoned(...ymd(day), h[1])]];
  for (const b of busy) spans = spans.flatMap(([a, z]) => (b.end <= a || b.start >= z ? [[a, z]] : [[a, b.start], [b.end, z]].filter(([x, y]) => y > x)));
  return spans.filter(([a, z]) => z > Math.max(a, now));
}

async function call(init: RequestInit & { query?: string } = {}) {
  const res = await fetch(`/api/calendar${init.query ?? ""}`, {
    ...init,
    headers: { ...credentials(window.localStorage.getItem(KEY_STORE) ?? ""), "content-type": "application/json" },
    cache: "no-store",
  });
  const out = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) throw new Error(out.error ?? `Request failed (${res.status})`);
  return out;
}

export function LeadCalendar({ onBack }: { onBack?: () => void }) {
  const [now] = React.useState(() => Date.now());
  const today = dayOf(now);
  const [month, setMonth] = React.useState(today.slice(0, 7));
  const [pick, setPick] = React.useState(today);
  const [data, setData] = React.useState<Month | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyUi, setBusyUi] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  // The grid: Sunday on or before the 1st, whole weeks to the month's end.
  const first = `${month}-01`;
  const gridStart = plus(first, -weekday(first));
  const lastDay = plus(plus(first, 31).slice(0, 7) + "-01", -1);
  const cells = Array.from({ length: Math.ceil((weekday(first) + Number(lastDay.slice(8))) / 7) * 7 }, (_, i) => plus(gridStart, i));

  const from = cells[0];
  const to = cells[cells.length - 1];
  React.useEffect(() => {
    let live = true;
    call({ query: `?from=${from}&to=${to}` })
      .then((o) => live && (setData(o as unknown as Month), setError(null)))
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => void (live = false);
  }, [from, to, tick]);
  const load = () => setTick((t) => t + 1);

  const post = async (body: unknown) => {
    setBusyUi(true);
    setError(null);
    try {
      await call({ method: "POST", body: JSON.stringify(body) });
      load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusyUi(false);
    }
  };

  // What falls on each day.
  const byDay = React.useMemo(() => {
    const m = new Map<string, { events: Ev[]; busy: Busy[] }>();
    const at = (d: string) => m.get(d) ?? (m.set(d, { events: [], busy: [] }), m.get(d)!);
    for (const e of data?.events ?? []) for (const d of daysOf(e.start, e.end)) at(d).events.push(e);
    for (const b of data?.busy ?? []) for (const d of daysOf(b.start, b.end)) at(d).busy.push(b);
    return m;
  }, [data]);

  const shift = (n: number) => {
    const [y, mo] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7);
    setMonth(d);
    setData(null);
  };

  return (
    <div style={{ fontFamily: 'var(--font-v2-text, "Helvetica Neue", Helvetica, Arial, sans-serif)', letterSpacing: 0 }} className="grid min-h-0 normal-case [&_input]:placeholder:normal-case [&_button]:normal-case [&_h2]:normal-case [&_h3]:normal-case [&_input]:normal-case lg:h-full lg:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-label="Calendar" className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-border">
        <header className="grid gap-2 border-b border-border px-1 pb-3 pt-2 lg:px-5 lg:pt-4">
          {onBack ? (
            <button type="button" onClick={onBack} className="inline-flex min-h-11 w-fit items-center gap-1 text-[16px] text-accent lg:hidden">
              <span aria-hidden="true">‹</span> More
            </button>
          ) : null}
          <div className="flex items-baseline justify-between gap-3">
            <h2 style={HEAD} className="text-[32px] leading-none lg:text-xl">
              <span className="lg:hidden">Calendar</span>
              <span className="max-lg:hidden">{new Date(`${first}T12:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}</span>
            </h2>
            <div className="flex items-center gap-1.5 font-mono text-[12.5px] text-muted-foreground">
              <button type="button" aria-label="Last month" onClick={() => shift(-1)} className="grid size-11 place-items-center rounded-[4px] border border-border lg:size-8">‹</button>
              <button type="button" onClick={() => { setMonth(today.slice(0, 7)); setPick(today); }} className="h-11 rounded-[4px] border border-border px-2.5 lg:h-8">Today</button>
              <button type="button" aria-label="Next month" onClick={() => shift(1)} className="grid size-11 place-items-center rounded-[4px] border border-border lg:size-8">›</button>
            </div>
          </div>
          <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground lg:hidden">
            {new Date(`${first}T12:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
          </p>
        </header>

        <div className="grid grid-cols-7" role="group" aria-label="Month" aria-busy={!data}>
          {DOW.map((d) => (
            <div key={d} className="border-b border-border px-2 pb-1.5 pt-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              <span className="lg:hidden">{d[0]}</span>
              <span className="max-lg:hidden">{d}</span>
            </div>
          ))}
          {cells.map((d) => {
            const on = byDay.get(d);
            const blockedAll = on?.events.some((e) => e.block && e.allDay);
            const closed = !HOURS[weekday(d)];
            const out = d.slice(0, 7) !== month;
            const marks = (on?.events ?? []).filter((e) => !(e.block && e.allDay));
            return (
              <button
                key={d}
                type="button"
                onClick={() => setPick(d)}
                aria-pressed={pick === d}
                aria-label={new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })}
                className={cn(
                  "relative flex min-h-[52px] flex-col items-center gap-1 overflow-hidden border-b border-r border-border px-1 py-1.5 text-left [&:nth-child(7n)]:border-r-0 lg:min-h-[92px] lg:items-stretch lg:px-[7px]",
                  closed && "bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--border)_6px_7px)]",
                  blockedAll && "bg-card",
                  pick === d && "shadow-[inset_0_0_0_1.5px_var(--accent)]",
                )}
              >
                <span className={cn("font-mono text-[12.5px] text-muted-foreground", (out || d < today) && "opacity-45", d === today && "font-medium text-accent", blockedAll && "line-through")}>
                  {Number(d.slice(8))}
                </span>
                {/* Desktop: chips. Phone: dots. */}
                <span className="grid gap-[3px] max-lg:hidden">
                  {blockedAll ? <Chip kind="block">{on!.events.find((e) => e.block && e.allDay)!.title}</Chip> : null}
                  {marks.map((e) => (
                    <Chip key={e.id} kind={e.block ? "block" : e.free ? "read" : "booked"}>
                      {e.allDay ? "" : `${time(Date.parse(e.start))} `}{e.title}
                    </Chip>
                  ))}
                  {on?.busy.map((b, i) => <Chip key={i} kind="read">{range(Date.parse(b.start), Date.parse(b.end))} {b.label}</Chip>)}
                </span>
                <span className="flex gap-[3px] lg:hidden" aria-hidden="true">
                  {marks.some((e) => !e.block && !e.free) ? <i className="size-[5px] rounded-full bg-accent" /> : null}
                  {on?.events.some((e) => e.block) ? <i className="size-[5px] rounded-full border border-foreground" /> : null}
                  {on?.busy.length || marks.some((e) => e.free) ? <i className="size-[5px] rounded-full bg-muted-foreground" /> : null}
                </span>
              </button>
            );
          })}
        </div>

        <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 py-3 font-mono text-[11.5px] text-muted-foreground max-lg:hidden lg:px-5">
          <span><i className="mr-1.5 inline-block h-[9px] w-3 rounded-[2px] bg-accent align-[-1px]" />Booked</span>
          <span><i className="mr-1.5 inline-block h-[9px] w-3 rounded-[2px] border border-foreground align-[-1px]" />Blocked by you</span>
          <span><i className="mr-1.5 inline-block h-[9px] w-[3px] bg-muted-foreground align-[-1px]" />Busy on a calendar it reads</span>
          <span>Hatched: closed</span>
        </p>

        {error ? <p role="alert" className="px-1 py-3 font-mono text-[13px] text-destructive lg:px-5">{error}</p> : null}
        {!data && !error ? <p className="px-1 py-3 font-mono text-[13px] text-muted-foreground lg:px-5">Loading the calendar</p> : null}

        <div className="max-lg:hidden">
          <Calendars extras={data?.extras} post={post} working={busyUi} />
        </div>
      </section>

      <aside aria-label="Day" className="min-w-0 lg:min-h-0 lg:overflow-y-auto lg:bg-card/40">
        <Day key={pick} day={pick} now={now} on={byDay.get(pick)} ready={!!data} post={post} working={busyUi} />
        <div className="lg:hidden">
          <Calendars extras={data?.extras} post={post} working={busyUi} />
        </div>
      </aside>
    </div>
  );
}

function Chip({ kind, children }: { kind: "booked" | "block" | "read"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "truncate rounded-[3px] px-[5px] py-[2px] font-mono text-[11px] leading-[1.3]",
        kind === "booked" && "bg-accent text-accent-foreground",
        kind === "block" && "border border-foreground",
        kind === "read" && "rounded-none border-l-2 border-muted-foreground text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

type Post = (body: unknown) => Promise<boolean>;

function Day({ day, now, on, ready, post, working }: { day: string; now: number; on?: { events: Ev[]; busy: Busy[] }; ready: boolean; post: Post; working: boolean }) {
  const [until, setUntil] = React.useState(day);
  const [start, setStart] = React.useState("10:00");
  const [end, setEnd] = React.useState("18:00");
  const [note, setNote] = React.useState("");
  const past = day < dayOf(now);
  const events = on?.events ?? [];
  const busy = [
    ...events.filter((e) => !e.free).map((e) => ({ start: Date.parse(e.start), end: Date.parse(e.end) })),
    ...(on?.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })),
  ];
  const spans = openSpans(day, busy, now);
  const starts = startsFor(EVENTS.portraits, busy, startOf(day), startOf(plus(day, 1)), now);
  const date = new Date(`${day}T12:00:00Z`);

  return (
    <div className="grid content-start gap-5 px-1 py-5 lg:px-[22px]">
      <div>
        <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">{date.toLocaleString("en-US", { weekday: "long", timeZone: "UTC" })}</p>
        <h3 style={HEAD} className="text-[22px]">{date.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</h3>
        {ready ? (
          <p className="mt-1.5 font-mono text-[12.5px] text-accent">
            {past ? "Past" : !HOURS[weekday(day)] ? <span className="text-muted-foreground">Closed</span> : spans.length ? `Open ${spans.map(([a, b]) => range(a, b)).join(", ")}` : <span className="text-muted-foreground">Nothing open</span>}
          </p>
        ) : null}
      </div>

      {events.length || on?.busy.length ? (
        <ul>
          {events.map((e) => (
            <li key={e.id} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-baseline gap-2.5 border-b border-border py-2.5">
              <span className="font-mono text-[12.5px] text-muted-foreground">{e.allDay ? "All day" : range(Date.parse(e.start), Date.parse(e.end))}</span>
              <span className="min-w-0 break-words">
                {e.title}
                <small className="block text-[13px] text-muted-foreground">{e.block ? "Blocked from here" : e.booking ? "Booked on the site" : e.free ? "Marked free" : "On hello@"}</small>
              </span>
              {e.block ? (
                <button type="button" disabled={working} onClick={() => post({ unblock: e.id })} className="min-h-11 font-mono text-[12.5px] text-accent disabled:opacity-50">
                  Unblock
                </button>
              ) : <span />}
            </li>
          ))}
          {on?.busy.map((b, i) => (
            <li key={i} className="grid grid-cols-[96px_minmax(0,1fr)] items-baseline gap-2.5 border-b border-border py-2.5">
              <span className="font-mono text-[12.5px] text-muted-foreground">{range(Date.parse(b.start), Date.parse(b.end))}</span>
              <span>Busy<small className="block text-[13px] text-muted-foreground">{b.label} · read only</small></span>
            </li>
          ))}
        </ul>
      ) : null}

      {past ? null : (
        <form className="grid gap-2.5" onSubmit={(e) => e.preventDefault()}>
          <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">Block</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={working} onClick={() => post({ block: { from: day, to: until < day ? day : until, note: note || undefined } }).then((ok) => ok && setNote(""))} className={cn(btn, "border-accent bg-accent text-accent-foreground")}>
              {until > day ? "Block the days" : "Block the day"}
            </button>
            <label className="font-mono text-[12.5px] text-muted-foreground" htmlFor="cal-until">until</label>
            <input id="cal-until" type="date" min={day} value={until} onChange={(e) => setUntil(e.target.value || day)} className={cn(field, "w-[150px]")} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12.5px] text-muted-foreground">or hours</span>
            <input aria-label="From" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className={cn(field, "w-[132px]")} />
            <span className="font-mono text-[12.5px]">to</span>
            <input aria-label="To" type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className={cn(field, "w-[132px]")} />
            <button type="button" disabled={working || end <= start} onClick={() => post({ block: { from: day, start, end, note: note || undefined } }).then((ok) => ok && setNote(""))} className={btn}>
              Block
            </button>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="Note (only you see it)" aria-label="Note" className={field} />
        </form>
      )}

      {ready && !past && starts.length ? (
        <div className="grid gap-2">
          <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">Portraits starts left</p>
          <p className="flex flex-wrap gap-1.5">
            {starts.map((s) => <span key={s} className="rounded-full border border-border px-2.5 py-1 font-mono text-[12px]">{time(s)}</span>)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Calendars({ extras, post, working }: { extras?: Extra[]; post: Post; working: boolean }) {
  const [label, setLabel] = React.useState("");
  const [src, setSrc] = React.useState("");
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await post({ extra: { label, src } })) {
      setLabel("");
      setSrc("");
    }
  };
  const row = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-border py-2.5";
  return (
    <div className="px-1 pb-6 pt-1.5 lg:px-5">
      <p className="pb-0.5 pt-2 font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">Calendars it reads</p>
      <div className={row}>
        <span>hello@juliangigola.com</span>
        <span className="row-span-2 self-center font-mono text-[12.5px] text-muted-foreground">books here</span>
        <span className="font-mono text-[12px] text-muted-foreground">Google · bookings and blocks go here</span>
      </div>
      {extras?.map((x) => (
        <div key={x.label} className={row}>
          <span className={cn("min-w-0 break-words", x.failed && "text-destructive")}>{x.label}</span>
          <button type="button" disabled={working} onClick={() => post({ drop: x.label })} className="row-span-2 min-h-11 self-center font-mono text-[12.5px] text-muted-foreground hoverable:hover:text-foreground disabled:opacity-50">
            Remove
          </button>
          <span className={cn("min-w-0 break-all font-mono text-[12px] text-muted-foreground", x.failed && "text-destructive")}>
            {x.ics ? "ICS" : "Google"} · {x.src} · {x.failed ? "could not read it, skipped" : "read only"}
          </span>
        </div>
      ))}
      <form onSubmit={add} className="mt-3 grid gap-2 lg:grid-cols-[150px_minmax(0,1fr)_auto]">
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="Name" aria-label="Calendar name" className={field} />
        <input value={src} onChange={(e) => setSrc(e.target.value)} placeholder="Google calendar id or ICS link" aria-label="Google calendar id or ICS link" className={field} />
        <button type="submit" disabled={working || !label.trim() || !src.trim()} className={btn}>Add</button>
      </form>
      <p className="mt-2 text-[13px] text-muted-foreground">A Google calendar needs sharing with hello@ (free/busy is enough). These only take times away, nothing is written to them.</p>
    </div>
  );
}
