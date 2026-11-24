import * as React from "react";
import { pad } from "@/lib/utils";

/** Two digits; `iso` below is a local date as "2026-11-04". The booking picker reuses both (`time-picker-parts.tsx`). */

/** A run of short items (the session's includes): each item stays whole,
    a dot rides at the end of every item but the last, so a line may end on
    a dot but never starts with one or splits an item, and `.run` keeps the
    last line from holding a lone item. */
export function DotList({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <p className={`run ${className}`}>
      {items.map((x, i) => (
        <React.Fragment key={x}>
          <span>{i < items.length - 1 ? `${x} ·` : x}</span>
          {i < items.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </p>
  );
}

/* Dates and times the way the master prints them. */
export const dlabel = (t: Date) => t.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
export const clockLabel = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  return `${((h + 11) % 12) + 1}:${pad(m % 60)} ${h < 12 ? "AM" : "PM"}`;
};
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** The month's cells, Monday first, blanks before the 1st. */
export const monthCells = (base: Date) => {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const n = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return [...Array<Date | null>(lead).fill(null), ...Array.from({ length: n }, (_, i) => new Date(base.getFullYear(), base.getMonth(), i + 1))];
};
/** The Monday-to-Sunday week holding `d`. */
export const weekCells = (d: Date) => {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => new Date(m.getFullYear(), m.getMonth(), m.getDate() + i));
};

/** The calendar block (master step 1): title, Week / Month, arrows, the days. */
export function Calendar({
  view,
  setView,
  anchor,
  shift,
  canBack,
  canNext = true,
  picked,
  tag,
  onPick,
  parts,
}: {
  view: "week" | "month";
  setView: (v: "week" | "month") => void;
  anchor: Date;
  shift: (dir: number) => void;
  canBack: boolean;
  canNext?: boolean;
  picked: string;
  /** A day's tag ("3 open", "Open") or null when it cannot be picked. */
  tag: (d: Date) => string | null;
  onPick: (d: Date) => void;
  /** Sky picker only: which of morning, afternoon, evening still have a time, as three colored dots. */
  parts?: (d: Date) => boolean[] | null;
}) {
  const cells = view === "month" ? monthCells(anchor) : weekCells(anchor);
  const head = view === "month" ? anchor : (cells[0] as Date);
  return (
    <>
      <div className="cal-top lbl">
        <span>{head.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
        <span className="seg">
          <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>Week</button>
          <button type="button" aria-pressed={view === "month"} onClick={() => setView("month")}>Month</button>
        </span>
        <span className="arrows">
          <button type="button" aria-label="Earlier" disabled={!canBack} onClick={() => shift(-1)}>&larr;</button>
          <button type="button" aria-label="Later" disabled={!canNext} onClick={() => shift(1)}>&rarr;</button>
        </span>
      </div>
      <div className={`cal lbl ${view}`}>
        {WEEKDAYS.map((w) => (
          <span key={w} className="wd">{w}</span>
        ))}
        {cells.map((t, k) => {
          if (!t) return <span key={`b${k}`} />;
          const id = iso(t);
          const tg = tag(t);
          /* Open times as up to three dots, so the tag never outgrows its square;
             the count stays in the label. */
          const open = tg && /open$/i.test(tg) ? Number(/^\d+/.exec(tg)?.[0] ?? 0) : -1;
          const sky = parts?.(t);
          return (
            <button key={id} type="button" data-day={id} aria-pressed={id === picked} disabled={tg === null} aria-label={`${dlabel(t)}${tg ? `, ${tg}` : ""}`} onClick={() => onPick(t)}>
              <b>{t.getDate()}</b>
              {sky ? (
                <span className="dots sky" aria-hidden="true">
                  {sky.map((on, i) => <i key={i} className={on ? undefined : "out"} />)}
                </span>
              ) : open >= 0 ? (
                <span className={open && open <= 2 ? "dots few" : "dots"} aria-hidden="true">
                  {Array.from({ length: open >= 7 ? 3 : open >= 3 ? 2 : 1 }, (_, i) => <i key={i} />)}
                </span>
              ) : (
                <span>{tg}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}
