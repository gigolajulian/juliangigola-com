"use client";

import * as React from "react";
import { STAGES } from "@/lib/leads/leads";
import type { Stats } from "@/lib/leads/lead-crm";
import { type Call, errorText, money } from "@/lib/leads/lead-desk";
import { HEAD } from "@/components/leads/shared";

const hours = (h: number | null) => (h === null ? "None yet" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`);

/** The numbers: is the site turning inquiries into bookings, and how fast does he answer. */
export function StatsView({ call }: { call: Call }) {
  const [s, setS] = React.useState<Stats | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => {
    call<{ stats: Stats }>({ query: "?stats" }).then((o) => setS(o.stats)).catch((e: unknown) => setErr(errorText(e)));
  }, [call]);
  if (err) return <p className="px-1 py-8 text-[15px] text-muted-foreground lg:px-5">{err}</p>;
  if (!s) return <p className="px-1 py-8 font-mono text-[13px] text-muted-foreground lg:px-5">Counting</p>;
  const top = Math.max(1, ...s.weeks.map((w) => w.inquiries));
  const tile = (k: string, v: string, hint: string) => (
    <div className="grid gap-1 rounded-xl border border-border p-3.5">
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{k}</span>
      <span style={HEAD} className="text-[26px] leading-none">{v}</span>
      <span className="text-[12.5px] text-muted-foreground">{hint}</span>
    </div>
  );
  return (
    <div className="grid gap-6 px-1 py-5 lg:px-5">
      <div className="grid grid-cols-2 gap-2.5">
        {tile("Booked", s.bookedRate === null ? "None yet" : `${Math.round(s.bookedRate * 100)}%`, "of leads over a week old")}
        {tile("First reply", hours(s.replyHours), "median, inquiry to answer")}
        {tile("Quoted, open", money(s.pipeline), "waiting on an answer")}
        {tile("Booked value", money(s.won), "from the quotes you entered")}
      </div>
      <section className="grid gap-2.5">
        <h3 aria-level={2} className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Last 12 weeks</h3>
        <div className="flex h-32 items-end gap-1.5" role="img" aria-label={s.weeks.map((w) => `Week of ${w.start}: ${w.inquiries} inquiries, ${w.booked} booked`).join(". ")}>
          {s.weeks.map((w) => (
            <div key={w.start} className="relative flex h-full flex-1 items-end" title={`Week of ${w.start}: ${w.inquiries} in, ${w.booked} booked`}>
              <div className="w-full rounded-t-[3px] bg-border" style={{ height: `${(w.inquiries / top) * 100}%` }} />
              <div className="absolute bottom-0 w-full rounded-t-[3px] bg-accent" style={{ height: `${(Math.min(w.booked, w.inquiries || w.booked) / top) * 100}%` }} />
            </div>
          ))}
        </div>
        <p className="flex gap-4 font-mono text-[12px] text-muted-foreground">
          <span><span className="mr-1.5 inline-block size-2.5 rounded-[2px] bg-border align-middle" />Inquiries</span>
          <span><span className="mr-1.5 inline-block size-2.5 rounded-[2px] bg-accent align-middle" />Booked</span>
        </p>
      </section>
      <section className="grid gap-1">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Where they came from</h3>
        {s.sources.length ? s.sources.map((r) => (
          <p key={r.source} className="flex justify-between gap-3 border-b border-border py-2.5 text-[15px]">
            <span className="truncate">{r.source}</span>
            <span className="shrink-0 font-mono text-[13px] text-muted-foreground">{r.leads} in · <b className="font-medium text-accent">{r.booked} booked</b></span>
          </p>
        )) : <p className="text-[15px] text-muted-foreground">Nothing yet.</p>}
      </section>
      <section className="grid gap-1">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Why they were lost</h3>
        {s.lost.length ? s.lost.map((r) => (
          <p key={r.reason} className="flex justify-between border-b border-border py-2.5 text-[15px]"><span>{r.reason}</span><span className="font-mono text-[13px] text-muted-foreground">{r.n}</span></p>
        )) : <p className="text-[15px] text-muted-foreground">None lost.</p>}
      </section>
      <section className="grid gap-1">
        <h3 aria-level={2} className="pb-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">By stage · {s.total} leads</h3>
        {STAGES.map((st) => (
          <p key={st} className="flex justify-between border-b border-border py-2.5 text-[15px]"><span>{st}</span><span className="font-mono text-[13px] text-muted-foreground">{s.stages[st] ?? 0}</span></p>
        ))}
      </section>
    </div>
  );
}
