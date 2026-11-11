"use client";

import * as React from "react";
import { TOKEN_STORE } from "@/lib/admin-github";
import { isLate, paperDue, shootTag, type LeadSummary } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { HEAD } from "@/components/leads/shared";
import { adminCall, ago, aside, at, cash, closed, type Filter, needsMe, nextStep, now, pass, plusDays, renew, ymdPT } from "@/lib/lead-desk";
import { TZ } from "@/lib/booking/booking-rules";

/* ── Today, the One Desk's first page ─────────────────────────────
 * Julian (2026-11-09, mock claude.ai/artifact/Y2PXE3dJZcj7oJw5TyihLF, hero
 * C): the week as a row, Mon to Sun, with shoots, calls and what falls
 * due, then Your move, Coming up, Money and the site's traffic. Every
 * number is one the desk already has: lead summaries, `/api/money`,
 * `/api/traffic`. What is owed on invoices is left out: summaries do not
 * carry invoices and nothing marks one paid.
 * ─────────────────────────────────────────────────────────────── */

const dayHead = (d: string) => `${new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} ${+d.slice(8)}`;
const clock = (ms: number) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(ms);
/** Where a move comes from, as the mock tags it. */
const source = (l: LeadSummary) => (renew(l) ? "Licence" : paperDue(l, now()) ? "Paperwork" : l.stage === "Invoiced" || l.stage === "Selecting" ? "Proofs" : "Leads");
const callOrShoot = (l: LeadSummary) => (l.stage === "Call booked" ? "Call" : shootTag(l.kind) ?? "Shoot");

type DayEv = { small: string; text: string; who?: string; due?: boolean; l: LeadSummary };

/** Each Pacific day from `from` for `n` days, with what is on it. Moves with no date land today. */
function daysOf(leads: LeadSummary[], from: string, n: number) {
  const today = ymdPT(now());
  const map = new Map<string, DayEv[]>();
  const put = (d: string, e: DayEv) => map.set(d, [...(map.get(d) ?? []), e]);
  for (const l of leads) {
    if (aside(l)) continue;
    const who = l.name || l.email;
    if (l.when && !closed(l.stage)) {
      const ms = Date.parse(l.when);
      put(ymdPT(ms), { small: `${clock(ms)} ${callOrShoot(l)}`, text: who, l });
    }
    const step = needsMe(l) ? nextStep(l) : null;
    if (step) put(today, { small: "Due", text: step, who, due: true, l });
    else if (l.due && Date.parse(l.due) > now()) put(ymdPT(Date.parse(l.due)), { small: "Reminder", text: l.dueText || "Your reminder", who, l });
  }
  return Array.from({ length: n }, (_, i) => plusDays(from, i)).map((d) => ({ d, today: d === today, evs: map.get(d) ?? [] }));
}

function Item({ k, t, n, s, onClick, className }: { k: React.ReactNode; t?: string; n: string; s?: string | null; onClick?: () => void; className?: string }) {
  const body = (
    <>
      <span className="truncate font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">{k}</span>
      <span className="text-right font-mono text-[12px] text-muted-foreground">{t}</span>
      <span className="truncate text-[16.5px] font-semibold">{n}</span>
      <span className="self-end text-right font-mono text-[12.5px] font-medium text-accent">{s ? `${s} →` : null}</span>
    </>
  );
  const cls = cn("grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 border-b border-border py-3 text-left", className);
  return onClick ? <button type="button" onClick={onClick} className={cn(cls, "transition-colors duration-200 hoverable:hover:bg-card")}>{body}</button> : <div className={cls}>{body}</div>;
}

type Spark = { visits: number; days: { key: string; n: number }[] };

function DeskToday({ leads, go, pick }: { leads: LeadSummary[]; go: (l: LeadSummary) => void; pick: (f: Filter) => void }) {
  const today = ymdPT(now());
  const monday = plusDays(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  const week = daysOf(leads, monday, 7);
  // Phone: the next three days that have something, today first.
  const soon = daysOf(leads, today, 21).filter((x) => x.today || x.evs.length).slice(0, 3);
  const moves = leads.filter(needsMe).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const late = moves.filter((l) => isLate(l, now())).length;
  const coming = leads.filter((l) => pass(l, "upcoming")).sort((a, b) => a.when!.localeCompare(b.when!)).slice(0, 4);
  // Sessions and calls dated this week, from today on.
  const booked = week.filter((x) => x.d >= today).flatMap((x) => x.evs.filter((e) => !e.due && e.small !== "Reminder"));
  const calls = booked.filter((e) => e.l.stage === "Call booked").length;
  const shoots = booked.length - calls;

  const [money, setMoney] = React.useState<{ available?: number; pending?: number } | string | null>(null);
  React.useEffect(() => {
    adminCall<{ available?: number; pending?: number }>("/api/money")
      .then(setMoney)
      .catch(() => setMoney("Not connected"));
  }, []);
  // Traffic answers to the GitHub token only, as on /admin.
  const [traffic, setTraffic] = React.useState<Spark | string | null>(null);
  React.useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORE);
    if (!token) return queueMicrotask(() => setTraffic("GitHub token needed"));
    fetch("/api/traffic", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (r) => { const o = await r.json(); if (!r.ok) throw new Error(o.error ?? "Cloudflare did not answer."); setTraffic(o); })
      .catch(() => setTraffic("Cloudflare did not answer"));
  }, []);
  const t = typeof traffic === "object" ? traffic : null;
  const peak = t ? Math.max(1, ...t.days.map((d) => d.n)) : 1;
  const spark = t ? t.days.map((d, i, a) => `${(i / Math.max(1, a.length - 1)) * 120},${20 - (d.n / peak) * 17}`).join(" ") : "";
  const m = typeof money === "object" ? money : null;

  const hour = +new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now());
  const hello = hour >= 5 && hour < 12 ? "Morning" : hour >= 12 && hour < 18 ? "Afternoon" : "Evening";
  const weekday = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" }).format(new Date(iso));
  const nextShoot = coming.find((l) => l.stage !== "Call booked");
  const nextCall = coming.find((l) => l.stage === "Call booked");
  const line = [
    moves.length ? `${moves.length} on you` : null,
    nextShoot ? `a shoot ${ymdPT(Date.parse(nextShoot.when!)) === today ? "today" : weekday(nextShoot.when!)}` : null,
    nextCall ? `a call ${ymdPT(Date.parse(nextCall.when!)) === today ? "today" : weekday(nextCall.when!)}` : null,
  ].filter(Boolean).join(", ");

  const card = "rounded-xl bg-card";
  const kpi = (k: string, v: React.ReactNode, sub: React.ReactNode, cls?: string) => (
    <div className={cn(card, "grid content-between gap-1 px-3.5 py-3", cls)} style={{ containerType: "inline-size" }}>
      <span className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">{k}</span>
      {/* A long figure ($1,234.56 at 390) shrinks to the tile instead of spilling or cutting. */}
      <span style={{ ...HEAD, fontSize: typeof v === "string" ? `min(26px, ${(180 / v.length).toFixed(1)}cqi)` : 26 }} className="leading-none tabular-nums [overflow-wrap:anywhere]">{v}</span>
      <span className="font-mono text-[12px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">{sub}</span>
    </div>
  );
  const head = (title: string, more: string, f: Filter) => (
    <h2 style={{ textTransform: "uppercase" }} className="label mb-1 flex items-baseline justify-between font-mono text-[11.5px] uppercase tracking-[0.1em] text-muted-foreground">
      {title}
      <button type="button" onClick={() => pick(f)} className="min-h-8 tracking-normal text-accent hoverable:hover:underline">{more} →</button>
    </h2>
  );

  return (
    <div className="grid content-start gap-4 px-1 py-4 lg:gap-[18px] lg:px-6 lg:py-[22px]">
      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className={cn(card, "grid content-between gap-3 px-[18px] py-4 lg:min-h-[176px]")}>
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }).format(now())} · {clock(now())}
            </p>
            <h1 style={HEAD} className="mt-1.5 text-[30px] leading-[1.05] tracking-[-0.03em]">{hello}, Julian.</h1>
          </div>
          <p className="text-[14px] text-muted-foreground">{line ? <><span className="text-accent">{line.split(", ")[0]}</span>{line.includes(", ") ? `, ${line.split(", ").slice(1).join(", ")}` : ""}.</> : "Nothing on the books this week."}</p>
        </div>
        <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-2">
          {kpi("On you", <span className="text-accent">{moves.length}</span>, late ? `${late} late` : "none late")}
          {kpi("This week", booked.length, `${shoots} ${shoots === 1 ? "shoot" : "shoots"}, ${calls} ${calls === 1 ? "call" : "calls"}`)}
          {kpi("Stripe", m ? cash(m.available ?? 0) : "–", m ? `${cash(m.pending ?? 0)} on the way` : typeof money === "string" ? money : "Asking Stripe")}
          {kpi(
            "Visits, 7 d",
            t ? t.visits.toLocaleString("en-US") : "–",
            t ? <svg viewBox="0 0 120 22" preserveAspectRatio="none" className="h-[18px] w-full" role="img" aria-label={`Visitors, last ${t.days.length} days`}><polyline fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" points={spark} /></svg> : typeof traffic === "string" ? traffic : "Asking Cloudflare",
            "max-lg:hidden",
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-7">
        {week.map((x) => <DayTile key={x.d} {...x} go={go} className={cn("max-lg:hidden")} />)}
        {soon.map((x) => <DayTile key={`p${x.d}`} {...x} go={go} className="lg:hidden" />)}
      </div>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className={cn(card, "px-3.5 pb-1 pt-3")}>
          {head("Your move", "All", "needs")}
          {moves.length ? moves.slice(0, 5).map((l, i) => (
            <Item
              key={l.id}
              className={cn("last:border-b-0", i >= 3 && "max-lg:hidden")}
              onClick={() => go(l)}
              k={<>{l.kind ? <b className="font-medium text-foreground">{shootTag(l.kind)}</b> : null}{l.kind ? " · " : null}{ago(l.lastAt)} · {source(l)}</>}
              t={l.stage}
              n={l.name || l.email}
              s={nextStep(l)}
            />
          )) : <p className="py-3 text-[15px] text-muted-foreground">Nothing waiting on you.</p>}
        </section>
        <section className={cn(card, "content-start px-3.5 pb-1 pt-3")}>
          {head("Coming up", "Calendar", "upcoming")}
          {coming.length ? coming.map((l) => (
            <Item key={l.id} className="last:border-b-0" onClick={() => go(l)} k={<><b className="font-medium text-foreground">{callOrShoot(l)}</b> · {at(l.when!)}</>} t={l.paid ? "Deposit paid" : l.stage} n={l.name || l.email} s={nextStep(l)} />
          )) : <p className="py-3 text-[15px] text-muted-foreground">No calls or sessions coming up.</p>}
        </section>
      </div>
    </div>
  );
}

/** One day of the week row, as a tile: today carries the accent on its top edge. */
function DayTile({ d, today, evs, go, className }: { d: string; today: boolean; evs: DayEv[]; go: (l: LeadSummary) => void; className?: string }) {
  const MAX = 3;
  return (
    <div className={cn("grid min-h-[86px] content-start gap-1.5 rounded-[10px] bg-card px-2.5 py-2", today && "shadow-[inset_0_2px_0_var(--accent)]", className)}>
      <span className={cn("font-mono text-[10.5px] uppercase tracking-[0.08em]", today ? "text-accent" : "text-muted-foreground")}>{dayHead(d)}</span>
      {evs.slice(0, MAX).map((e, i) => (
        <button key={i} type="button" onClick={() => go(e.l)} title={e.who} className={cn("grid min-w-0 text-left text-[12.5px] leading-[1.25] hoverable:hover:underline", e.due && "text-accent")}>
          <small className="font-mono text-[9.5px] uppercase tracking-[0.05em] text-muted-foreground">{e.small}</small>
          <span className="truncate">{e.text}</span>
          {e.who && e.who !== e.text ? <span className="truncate text-[11.5px] text-muted-foreground">{e.who}</span> : null}
        </button>
      ))}
      {evs.length > MAX ? <span className="font-mono text-[10.5px] text-muted-foreground">+{evs.length - MAX} more</span> : null}
    </div>
  );
}

export { DeskToday };
