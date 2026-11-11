"use client";

import * as React from "react";
import { isLate, shootTag, trashDaysLeft, type LeadSummary } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { kindOf, STEPS } from "@/components/admin/leads/shared";
import { ago, at, day, money, nextStep, now, snoozed } from "@/lib/lead-desk";

/** How far a lead has come: a short segment per stage, then its name. */
function StageLine({ l }: { l: LeadSummary }) {
  const at = STEPS.indexOf(l.stage);
  return (
    <span className="flex shrink-0 items-center gap-2.5 font-mono text-[12px] text-muted-foreground">
      {at >= 0 ? (
        <span aria-hidden="true" className="flex shrink-0 gap-[3px]">
          {STEPS.map((s, k) => <i key={s} className={cn("h-[3px] w-3 rounded-full", k < at ? "bg-foreground/55" : k === at ? "bg-foreground" : "bg-border")} />)}
        </span>
      ) : null}
      <span className="truncate font-medium text-foreground">{l.stage}</span>
      {isLate(l, now()) ? <span className="shrink-0 text-accent">{ago(l.stageAt)}</span> : null}
    </span>
  );
}

/** The one thing to do, in teal; money stuck in red; otherwise why it is put aside. */
function RowAction({ l, next }: { l: LeadSummary; next: string | null }) {
  // Wraps instead of cutting: Julian wants the whole step on the row.
  const cls = "min-w-0 text-right font-mono text-[12.5px] font-medium [text-wrap:balance]";
  if (l.trashedAt) return <span className={cn(cls, "text-muted-foreground")}>Deletes in {Math.max(1, trashDaysLeft(l.trashedAt, now()))} d</span>;
  const bad = l.flags?.includes("stuck") ? "Deposit stuck" : l.flags?.includes("no-deposit") ? "No deposit" : null;
  if (bad) return <span className={cn(cls, "text-destructive")}>! {bad} →</span>;
  if (next) return <span title={next} className={cn(cls, "text-accent")}>{next}{" "}→</span>;
  if (snoozed(l)) return <span className={cn(cls, "text-muted-foreground")}>Until {day(l.snoozeUntil!)}</span>;
  return l.refs ? <span className={cn(cls, "text-muted-foreground")}>{l.refs} {l.refs === 1 ? "picture" : "pictures"}</span> : null;
}

/** One lead in a list: who, what and when, the start of their message, where it stands and what is next. */
function Row({ l, on, upcoming, onClick }: { l: LeadSummary; on: boolean; upcoming: boolean; onClick: () => void }) {
  const next = nextStep(l);
  return (
    <button
      type="button"
      onClick={onClick}
      data-lead={l.id}
      aria-current={on ? "true" : undefined}
      className={cn(
        "flex w-full gap-3 border-b border-border px-3 py-[18px] text-left transition-colors duration-200 hoverable:hover:bg-card lg:px-7",
        on && "bg-card shadow-[inset_3px_0_0_var(--accent)]",
      )}
    >
      <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-mono text-[11px] uppercase tracking-[0.09em] text-muted-foreground">
            {l.kind ? <b className="font-medium text-foreground" title={kindOf(l.kind)}>{shootTag(l.kind)}</b> : null}
            {l.kind && l.when ? " · " : null}
            {l.when ? at(l.when) : null}
          </span>
          <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{upcoming && l.when ? day(l.when) : ago(l.lastAt)}</span>
        </span>
        <span className="flex min-w-0 items-center gap-2 text-[18px] font-semibold tracking-[-0.01em]">
          {l.unread ? <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="New" /> : null}
          <span className="truncate">{l.name}</span>
        </span>
        {l.snippet ? <span className="line-clamp-2 text-[14.5px] leading-snug text-muted-foreground">{l.snippet}</span> : null}
        <span className="mt-2 flex items-center justify-between gap-3">
          <StageLine l={l} />
          <RowAction l={l} next={next} />
        </span>
      </span>
    </button>
  );
}

/** A row cut down for the board: kind and age, name, the next step, the quote. */
function Card({ l, on, onClick }: { l: LeadSummary; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-lead={l.id}
      aria-current={on ? "true" : undefined}
      className={cn("grid w-full gap-0.5 rounded-[10px] bg-card px-2.5 py-2 text-left transition-colors duration-200 hoverable:hover:bg-muted", on && "shadow-[inset_3px_0_0_var(--accent)]")}
    >
      <span className="flex justify-between gap-2 font-mono text-[11.5px] uppercase tracking-[0.09em] text-muted-foreground">
        <span className="truncate" title={kindOf(l.kind)}>{shootTag(l.kind)}</span>
        <span className="shrink-0">{ago(l.lastAt)}</span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold">
        {l.unread ? <span className="size-[7px] shrink-0 rounded-full bg-accent" aria-label="New" /> : null}
        <span className="truncate">{l.name}</span>
      </span>
      <span className="mt-1 flex items-center justify-between gap-2">
        <span className="min-w-0 text-left"><RowAction l={l} next={nextStep(l)} /></span>
        {l.quote ? <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">{money(l.quote)}</span> : null}
      </span>
    </button>
  );
}

const LIST_W_STORE = "jg-leads-list-w";
const LIST_W = 420;
const clampW = (w: number) => Math.min(720, Math.max(300, Math.round(w)));

/** Desktop: the line between the list and the open lead. Drag or arrow keys to move it, double-click to reset. */
function ListResizer({ w, onChange }: { w: number; onChange: (w: number | null) => void }) {
  const drag = React.useRef<{ x: number; w: number } | null>(null);
  const save = (v: number | null) => {
    onChange(v);
    try {
      if (v) window.localStorage.setItem(LIST_W_STORE, String(v));
      else window.localStorage.removeItem(LIST_W_STORE);
    } catch {}
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="List width"
      aria-valuenow={w}
      aria-valuemin={300}
      aria-valuemax={720}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
      style={{ left: `calc(220px + ${w}px - 3px)` }}
      className="absolute inset-y-0 z-10 hidden w-1.5 cursor-col-resize touch-none outline-none hoverable:hover:bg-accent/40 focus-visible:bg-accent/60 lg:block"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, w };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => drag.current && onChange(clampW(drag.current.w + e.clientX - drag.current.x))}
      onPointerUp={(e) => {
        if (!drag.current) return;
        save(clampW(drag.current.w + e.clientX - drag.current.x));
        drag.current = null;
      }}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => save(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          save(clampW(w + (e.key === "ArrowLeft" ? -16 : 16)));
        }
      }}
    />
  );
}

function SideLink({ on, n, onClick, href, icon, className, children }: { on: boolean; n?: number; onClick?: () => void; href?: string; icon?: React.ReactNode; className?: string; children: React.ReactNode }) {
  const El = href ? "a" : "button";
  return (
    <El
      {...(href ? { href } : { type: "button" as const, onClick, "aria-pressed": on })}
      className={cn(
        "flex min-h-10 items-center justify-between gap-4 rounded-lg px-3 text-[14.5px] transition-colors duration-200",
        on ? "bg-card font-semibold text-foreground shadow-[inset_2px_0_0_var(--accent)]" : "text-muted-foreground hoverable:hover:bg-card hoverable:hover:text-foreground",
        className,
      )}
    >
      <span className="flex items-center gap-2.5">
        {icon ? <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[17px] shrink-0 fill-none stroke-current stroke-[1.6] [stroke-linecap:round] [stroke-linejoin:round]">{icon}</svg> : null}
        {children}
      </span>
      {n === undefined || n < 0 ? null : <span className={cn("font-mono text-[12.5px]", on ? "text-accent" : "text-muted-foreground")}>{n}</span>}
    </El>
  );
}

function Pill({ on, n, onClick, children }: { on: boolean; n: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 font-mono text-[12.5px]",
        on ? "border-accent text-accent" : "border-border text-muted-foreground",
      )}
    >
      {children} <span className={on ? "text-accent" : "text-muted-foreground/70"}>{n}</span>
    </button>
  );
}

export { Row, Card, LIST_W_STORE, LIST_W, clampW, ListResizer, SideLink, Pill };
