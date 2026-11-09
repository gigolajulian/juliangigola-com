"use client";

import * as React from "react";
import { renewDue, type Lead, type LeadSummary } from "@/lib/leads";
import { cn } from "@/lib/utils";

/* ── licences on commercial work ──────────────────────────────────
 * Julian (2026-11-08, CRMO plan, feature 5): usage and an end date,
 * opt-in per lead behind "+ Licence" in Money, so portrait leads never see
 * it. LICENCE_DAYS before the end the lead comes back to Your move with
 * "Renew licence" (`renewDue` in lib/leads.ts). One list, by end date.
 * ─────────────────────────────────────────────────────────────── */

type Cls = { btn: string; field: string; label: string };

export const endDay = (end: string) => new Date(`${end}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** The licence block inside Money: a link until he adds one. */
export function LicenceField({ full, patch, run, cls }: { full: Lead | null; patch: (b: Record<string, unknown>) => Promise<void>; run: (p: Promise<void>, ok?: string) => void; cls: Cls }) {
  const has = full?.licence;
  const [open, setOpen] = React.useState(false);
  const [use, setUse] = React.useState(has?.use ?? "");
  const [end, setEnd] = React.useState(has?.end ?? "");
  if (!full) return null;
  if (!has && !open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="justify-self-start font-mono text-[12.5px] text-accent">
        + Licence
      </button>
    );
  return (
    <form
      className="flex flex-wrap items-end gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (end) run(patch({ licence: { use, end } }), "Licence saved.");
      }}
    >
      <label className={cn(cls.label, "min-w-[12rem] flex-1")}>Licence<input value={use} onChange={(e) => setUse(e.target.value)} placeholder="Web + social, US" className={cls.field} /></label>
      <label className={cls.label}>Ends<input type="date" required value={end} onChange={(e) => setEnd(e.target.value)} className={cn(cls.field, "w-auto font-mono text-[14px]")} /></label>
      <button type="submit" className={cls.btn}>Save</button>
      <button
        type="button"
        className={cls.btn}
        onClick={() => (has ? run(patch({ licence: null }).then(() => { setUse(""); setEnd(""); setOpen(false); }), "Licence cleared.") : setOpen(false))}
      >
        {has ? "Clear" : "Cancel"}
      </button>
    </form>
  );
}

/** Every lead with a licence, soonest end first. */
export function LicenceList({ leads, row }: { leads: LeadSummary[]; row: (l: LeadSummary) => React.ReactNode }) {
  const [now] = React.useState(() => Date.now());
  const list = leads.filter((l) => l.licence).sort((a, b) => a.licence!.end.localeCompare(b.licence!.end));
  if (!list.length) return <p className="px-1 py-10 text-[15px] text-muted-foreground lg:px-5">No licences yet. Add one under Money on a lead.</p>;
  return (
    <ul>
      {list.map((l) => (
        <li key={l.id}>
          <p className="flex items-baseline justify-between gap-3 px-1 pt-3 font-mono text-[12px] text-muted-foreground lg:px-5">
            <span className="truncate">{l.licence!.use || "Licence"}</span>
            <span className={cn("shrink-0", renewDue(l, now) && "text-accent")}>Ends {endDay(l.licence!.end)}</span>
          </p>
          {row(l)}
        </li>
      ))}
    </ul>
  );
}

