"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { TZ, DAY_MS } from "@/lib/time-zone";
import { AHEAD, DAYS, minutesOf, MONTHS, WEEKDAYS, clock, zoneAbbr } from "@/components/booking/picker/parts";
import type { CardCtx } from "@/components/booking/picker/use-picker";
import { localDayKey } from "@/components/booking/picker/dates";
import { usePickerLayout } from "@/components/booking/picker/use-layout";
import { arrowMark, okMarkOf } from "@/components/booking/picker/marks";

/* A call (no deposit) shows a handset. */
const HANDSET = (
  <svg aria-hidden viewBox="0 0 24 24" className="ed-handset" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
    <path d="M5 3h3.5l1.5 4.5-2.25 1.5a11 11 0 0 0 5.25 5.25l1.5-2.25L19 13.5V17a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />
  </svg>
);
/** A session's length, short: "45 min", "1 hr 30 min". Not `duration` (`lib/booking/rules.ts`), which writes "45 minutes", "2 hours". */
export const shortDuration = (length: number) =>
  length >= 60 ? `${Math.floor(length / 60)} hr${length % 60 ? ` ${length % 60} min` : ""}` : `${length} min`;
/* The month's weekday heads, Monday first, as its cells (`monthCells`). */
const MONTH_HEAD = [...DAYS.slice(1), DAYS[0]];

/* The time step as a magazine page (editorial.css). Only a reschedule draws it (`manage-booking.tsx`): Continue
   hands the time to `onPicked`, so it has no form, deposit or booked view of its own. */
export function EditorialCard({ c }: { c: CardCtx }) {
  const {
    title,
    className,
    tz,
    here,
    length,
    session,
    days,
    view,
    anchor,
    pick,
    chosen,
    step,
    paid,
    ok,
    setOk,
    open,
    choose,
    today,
    week,
    month,
    shift,
    mstep,
    setMstep,
    switchView,
    atStart,
    t,
    ap,
    until,
    date,
    sum,
  } = c;
  const { root, showTimes, daysBox, slotsW, slotsRef, swipeProps } = usePickerLayout({
    step,
    pick,
    days,
    view,
    anchor,
    week,
    month,
    chosen,
    mstep,
    held: c.held,
    state: c.state,
    atStart,
    shift,
  });
  const arrow = arrowMark();
  /* Confirm's words turn into the orbs, then a check. */
  const okMark = okMarkOf(ok);
  const d3 = (d: Date) => DAYS[d.getDay()][0] + DAYS[d.getDay()].slice(1).toLowerCase();
  const mon = (d: Date) => MONTHS[d.getMonth()].slice(0, 3);
  const [, apEnd] = clock(pick.min + length);
  const tzName = zoneAbbr(pick.start, tz);
  /* A call (no deposit): a handset, its length in minutes, so it never reads as a clock time. */
  const call = !paid;
  const timer = shortDuration(length);
  const bar = (
    <nav aria-label="Steps" className="ed-steps label">
      {call ? (
        <span className="ed-call">
          {HANDSET}
          Call · {timer}
        </span>
      ) : null}
      {(paid ? ["Date", "Details", "Deposit"] : ["Date", "Details"]).map((s, i) => (
        <button key={s} type="button" disabled aria-current={i ? undefined : "step"}>
          <b>{`0${i + 1}`}</b>
          {s}
        </button>
      ))}
    </nav>
  );
  /* One face, two sizes:
     each step opens on one huge line, small caps beside and under it. */
  const what = `${session || title} · ${timer}`;
  const hero = (big: React.ReactNode, side: React.ReactNode, mark: React.ReactNode) => (
    <div className="ed-hero">
      <h2>
        {big}
        <small>{side}</small>
      </h2>
      <p className="ed-mk">
        <i />
        {mark}
      </p>
    </div>
  );
  const head = view === "week" ? week[0] : anchor;
  const name = view === "week" && week[0].getMonth() !== week[6].getMonth() ? `${mon(week[0])} / ${mon(week[6])}` : MONTHS[head.getMonth()];
  const year = (view === "week" ? week[6] : anchor).getFullYear();
  const last = view === "week" ? week[6] : new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  // Nothing to go on to past the times asked for.
  const atEnd = +last >= +today + AHEAD * DAY_MS;
  const dayPick = (id: string) => {
    choose(id, pick.min, false);
    if (root.current?.dataset.fit === "3") setMstep("times");
    showTimes();
  };
  /* Julian: the day's times in a line or two, no
     morning, afternoon or evening. One line when they fit at 5.75rem,
     else two even rows. */
  const dayTimes = days[pick.date] ?? [];
  const cols = dayTimes.length * 92 + (dayTimes.length - 1) * 8 <= slotsW ? dayTimes.length : Math.ceil(dayTimes.length / 2);
  const cells = [...month, ...Array.from({ length: (7 - (month.length % 7)) % 7 }, () => null)];
  return (
    <div ref={root} aria-label={title} role="region" data-view={view} data-mstep={mstep} className={cn("tp ed", className)}>
      {bar}
      {hero(
        `${d3(date)} ${date.getDate()} ${mon(date)}`,
        <>
          {chosen === "time" ? `${t}${ap === apEnd ? "" : ` ${ap}`} to ${until} ${apEnd}` : "Pick a time"}
          <br />
          {what}
        </>,
        chosen === "time" ? "Then your details" : "Pick a day, then a time",
      )}
      <>
        <div className="ed-body">
          <div className="ed-l">
            <div className="ed-head">
              <h2>
                {name}
                {year !== today.getFullYear() ? <span className="label">{year}</span> : null}
              </h2>
              <div className="ed-ctl label">
                {(["week", "month"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={view === v} onClick={() => switchView(v)}>
                    {v}
                  </button>
                ))}
                <button type="button" data-stick="" className="ed-arrow" aria-label="Earlier" disabled={atStart} onClick={() => shift(-1)}>
                  {arrow}
                </button>
                <button type="button" data-stick="" className="ed-arrow" aria-label="Later" disabled={atEnd} onClick={() => shift(1)}>
                  <span className="flex rotate-180">{arrow}</span>
                </button>
              </div>
            </div>
            <div ref={daysBox} className="touch-pan-y overflow-hidden" {...swipeProps}>
              {view === "week" ? (
                <div className="ed-week">
                  {week.map((d) => {
                    const id = localDayKey(d);
                    return (
                      <button
                        key={id}
                        data-day={id}
                        type="button"
                        disabled={!open(id).size}
                        aria-pressed={pick.date === id}
                        aria-label={`${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`}
                        onClick={() => dayPick(id)}
                        className="ed-day"
                      >
                        <span className="label">{DAYS[d.getDay()]}</span>
                        <span className="ed-n">{d.getDate()}</span>
                        <i />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div>
                  <div className="ed-mhead label">
                    {MONTH_HEAD.map((d) => (
                      <span key={d}>{d}</span>
                    ))}
                  </div>
                  <div className="ed-month">
                    {cells.map((d, k) => {
                      /* The days either side of the month, barely there. */
                      if (!d) {
                        const lead = month.findIndex(Boolean);
                        const n =
                          k < lead ? new Date(anchor.getFullYear(), anchor.getMonth(), k - lead + 1).getDate() : k - month.length + 1;
                        return (
                          <span key={`b${k}`} aria-hidden className="ed-blank">
                            {n}
                          </span>
                        );
                      }
                      const id = localDayKey(d);
                      return (
                        <button
                          key={id}
                          data-day={id}
                          type="button"
                          disabled={!open(id).size}
                          aria-pressed={pick.date === id}
                          aria-label={`${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`}
                          onClick={() => dayPick(id)}
                          data-stick={open(id).size ? "fill" : undefined}
                          className="ed-cell"
                        >
                          <span className="ed-n">{d.getDate()}</span>
                          <i />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div ref={slotsRef} className="ed-r ed-times">
            <button type="button" className="ed-back label" onClick={() => setMstep("days")}>
              {arrow}
              {view === "month" ? MONTHS[anchor.getMonth()] : "Week"}
            </button>
            <p className="ed-on label">{`${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`}</p>
            {dayTimes.length ? (
              <div className="ed-slots" style={{ gridTemplateColumns: `repeat(${Math.max(1, cols)}, minmax(0, 1fr))` }}>
                {dayTimes.map((x) => {
                  const m = minutesOf(x);
                  const [h, a] = clock(m);
                  return (
                    <button
                      key={x}
                      data-slot=""
                      type="button"
                      aria-pressed={chosen === "time" && m === pick.min}
                      aria-label={`${h} ${a}`}
                      onClick={() => choose(pick.date, m, true)}
                      data-stick="fill"
                      className="ed-slot"
                    >
                      {h} {a}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="ed-none label">No open times this day.</p>
            )}
          </div>
        </div>
        <div className="ed-floor">
          <span className="label flex flex-col gap-1">
            {chosen === "time" ? `${sum} ${tzName}` : `San Jose, CA · ${here}${tz === TZ ? "" : ` · times in ${tzName}`}`}
          </span>
          <button
            type="button"
            data-stick="fill"
            className="ed-btn"
            onClick={() => setOk("spin")}
            disabled={chosen !== "time"}
            aria-busy={!!ok}
          >
            <span className={cn("transition-opacity duration-200", ok && "opacity-0")}>Continue</span>
            {okMark}
          </button>
        </div>
      </>
    </div>
  );
}
