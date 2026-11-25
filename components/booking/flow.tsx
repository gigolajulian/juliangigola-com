import * as React from "react";
import { useSkyCalendar } from "@/components/booking/sky-motion";
import { WEEKDAYS, localDayKey, mondayIndex, monthCells, weekCells, weekdayDateLabel } from "@/components/booking/picker/dates";

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
  strip,
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
  /** Sky picker only: the days the week view shows in place of Monday to Sunday (the next open days). */
  strip?: Date[];
}) {
  const own = view === "week" && strip?.length ? strip : null;
  const cells = own ?? (view === "month" ? monthCells(anchor) : weekCells(anchor));
  const cal = React.useRef<HTMLDivElement>(null);
  const before = useSkyCalendar(!!parts, cal);
  const head = view === "month" ? anchor : (cells[0] as Date);
  return (
    <>
      <div className="cal-top lbl">
        {/* Announced when Earlier or Later moves the calendar to another month or week. */}
        <span aria-live="polite">
          {own && own.at(-1)!.getMonth() !== head.getMonth()
            ? `${head.toLocaleDateString("en-US", { month: "long" })} – ${own.at(-1)!.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
            : head.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <span className="seg">
          <button
            type="button"
            aria-pressed={view === "week"}
            onClick={() => {
              if (view !== "week") before(0);
              setView("week");
            }}
          >
            Week
          </button>
          <button
            type="button"
            aria-pressed={view === "month"}
            onClick={() => {
              if (view !== "month") before(0);
              setView("month");
            }}
          >
            Month
          </button>
        </span>
        <span className="arrows">
          <button
            type="button"
            aria-label="Earlier"
            disabled={!canBack}
            onClick={() => {
              before(-1);
              shift(-1);
            }}
          >
            &larr;
          </button>
          <button
            type="button"
            aria-label="Later"
            disabled={!canNext}
            onClick={() => {
              before(1);
              shift(1);
            }}
          >
            &rarr;
          </button>
        </span>
      </div>
      <div ref={cal} className={`cal lbl ${view}`} style={own ? { gridTemplateColumns: `repeat(${own.length},minmax(0,1fr))` } : undefined}>
        {(own ? own.map((d) => WEEKDAYS[mondayIndex(d)]) : WEEKDAYS).map((w, k) => (
          <span key={`${w}${k}`} className="wd">
            {w}
          </span>
        ))}
        {cells.map((t, k) => {
          if (!t) return <span key={`b${k}`} />;
          const id = localDayKey(t);
          const tg = tag(t);
          /* Open times as up to three dots, so the tag never outgrows its square;
             the count stays in the label. */
          const open = tg && /open$/i.test(tg) ? Number(/^\d+/.exec(tg)?.[0] ?? 0) : -1;
          const sky = parts?.(t);
          return (
            <button
              key={id}
              type="button"
              data-day={id}
              aria-pressed={id === picked}
              disabled={tg === null}
              aria-label={`${weekdayDateLabel(t)}${tg ? `, ${tg}` : ""}`}
              onClick={() => onPick(t)}
            >
              <b>{t.getDate()}</b>
              {sky ? (
                <span className="dots sky" aria-hidden="true">
                  {sky.map((on, i) => (
                    <i key={i} className={on ? undefined : "out"} />
                  ))}
                </span>
              ) : open >= 0 ? (
                <span className={open && open <= 2 ? "dots few" : "dots"} aria-hidden="true">
                  {Array.from({ length: open >= 7 ? 3 : open >= 3 ? 2 : 1 }, (_, i) => (
                    <i key={i} />
                  ))}
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
