import { pad } from "@/lib/utils";
import { TZ } from "@/lib/time-zone";

/* The booking calendars' pure date helpers: the stepper's `Calendar` (`flow.tsx`)
   and the picker (`use-picker.tsx`). Weeks run Monday to Sunday everywhere. */

/* Julian: the time where I am, with the place, before a time is picked. */
export const clockHere = () =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date());

/* Dates the way the master prints them. */
export const weekdayDateLabel = (t: Date) => t.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
/** The weekday heads, Monday first. */
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Where a day sits in a Monday-first week: Monday 0, Sunday 6. */
export const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;
/** A day on the visitor's own calendar as "2026-11-04" (local, not UTC). */
export const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/* The seven days from the one on show, never from before today. */
export function weekFrom(anchor: Date, today: Date) {
  const d = new Date(Math.max(+anchor, +today));
  d.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return x;
  });
}

/** The month's cells, Monday first, blanks before the 1st. */
export function monthCells(base: Date) {
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const n = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  return [
    ...Array<Date | null>(mondayIndex(first)).fill(null),
    ...Array.from({ length: n }, (_, i) => new Date(base.getFullYear(), base.getMonth(), i + 1)),
  ];
}

/** The Monday-to-Sunday week holding `d`. */
export function weekCells(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayIndex(d));
  return Array.from({ length: 7 }, (_, i) => new Date(m.getFullYear(), m.getMonth(), m.getDate() + i));
}
