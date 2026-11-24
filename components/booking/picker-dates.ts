import { TZ } from "@/lib/booking/rules";

/* The picker's pure date helpers (`use-picker.tsx`). */

/* Julian: the time where I am, with the place, before a time is picked. */
export const clockHere = () => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date());

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

/* The month on show, its first row padded to its weekday. */
export function monthCells(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  return [...Array.from({ length: first.getDay() }, () => null), ...Array.from({ length: count }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1))];
}
