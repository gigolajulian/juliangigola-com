/* ── when Julian can be booked, for the site's own engine ──────────
 * Copied from Cal.com on 2026-11-03 (its public event types and the
 * slots it offered): Wednesday to Sunday from 10 AM Pacific, nothing
 * Monday or Tuesday. Julian (2026-11-04): the last start is 7 PM. These are the defaults: Julian changes the week and
 * single dates from the lead desk (Hours), kept in the booking lock.
 * Client-safe: no server imports.
 * ─────────────────────────────────────────────────────────────── */

export const TZ = "America/Los_Angeles";

/** "60 minutes", "2 hours": the card and the confirmation mail say it the same way. */
export const duration = (min: number) => (min >= 120 ? `${min / 60} hours` : `${min} minutes`);

/** Minutes after midnight Pacific: the first start, the last start. */
export type Window = readonly [number, number];

/** Open hours per weekday (0 Sunday), minutes after midnight Pacific; null is closed. */
export const HOURS: (Window | null)[] = [
  [600, 1140],
  null,
  null,
  [600, 1140],
  [600, 1140],
  [600, 1140],
  [600, 1140],
];

/** The week, plus dates ("2026-11-10") that differ from it: a window, or null for closed. */
export type Hours = { week: (Window | null)[]; days?: Record<string, Window | null> };
export const DEFAULT_HOURS: Hours = { week: HOURS };

/** The window open on `ymd`, a `weekday` (0 Sunday), or null. */
export const windowOn = (h: Hours, ymd: string, weekday: number): Window | null =>
  (h.days && ymd in h.days ? h.days[ymd] : h.week[weekday]) ?? null;

const isWindow = (w: unknown): w is Window =>
  Array.isArray(w) && w.length === 2 && w.every((m) => Number.isInteger(m) && m >= 0 && m <= 1440 && m % 15 === 0) && w[0] <= w[1];

/** `x` as Hours when it is well formed, dates before `today` dropped; else null. */
export function cleanHours(x: unknown, today: string): Hours | null {
  const h = x as Hours;
  if (!h || !Array.isArray(h.week) || h.week.length !== 7 || !h.week.every((w) => w === null || isWindow(w))) return null;
  const days: Record<string, Window | null> = {};
  for (const [d, w] of Object.entries(h.days ?? {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || (w !== null && !isWindow(w))) return null;
    if (d >= today) days[d] = w;
  }
  if (Object.keys(days).length > 400) return null;
  return { week: h.week.map((w) => (w ? [w[0], w[1]] : null)), days };
}

export type Rule = {
  title: string;
  /** Minutes. */
  length: number;
  /** Minutes between now and the earliest start. */
  notice: number;
  /** Minutes kept free after the session. */
  after: number;
  /** Minutes kept free before it, after whatever is already booked. */
  before?: number;
  /** Minutes between offered starts; the length when unset, as Cal.com does. */
  interval?: number;
  /** How many days ahead may be booked; unset, the picker's own reach. */
  ahead?: number;
  /** A call (Meet or phone), not a shoot. */
  call?: boolean;
};

/* Julian (2026-11-04): an hour each side of a shoot, to travel between locations on the same day. */
const SHOOT = { notice: 2880, before: 60, after: 60, ahead: 180 };
const CALL = { length: 15, after: 0, interval: 30, call: true };

/** Every bookable event, by its Cal.com slug. */
export const EVENTS: Record<string, Rule> = {
  portraits: { title: "Portraits", length: 60, ...SHOOT },
  headshots: { title: "Headshots", length: 30, ...SHOOT },
  graduation: { title: "Graduation photos", length: 90, ...SHOOT },
  digitals: { title: "Studio digitals", length: 45, ...SHOOT },
  editorial: { title: "Editorial call", notice: 1440, ahead: 180, ...CALL },
  campaign: { title: "Brand & Campaign Call", notice: 1440, ahead: 180, ...CALL },
  consultation: { title: "Consultation", notice: 120, ...CALL },
  "music-call": { title: "Music call", notice: 120, ...CALL },
  "wedding-call": { title: "Wedding call", notice: 120, ...CALL },
};

/** Julian (2026-11-03): a cancel this many hours or more before the start refunds the $100; under it, none. */
export const REFUND_HOURS = 48;
/* Julian (2026-11-03, "refund by first time"): judged against the time first
   booked, so moving a session out and then cancelling keeps the deposit. A
   session moved earlier is judged by its new, earlier time. */
export const refundable = (r: { intent?: string; start: string; firstStart?: string }, now = Date.now()) =>
  !!r.intent && Math.min(Date.parse(r.start), Date.parse(r.firstStart ?? r.start)) - now >= REFUND_HOURS * 36e5;

/* Cut over: live books through the site's own engine (Google Calendar
   times, `/api/book`). NEXT_PUBLIC_BOOKING_ENGINE (.env.production) and
   the Worker's BOOKING_ENGINE (wrangler.jsonc) are both "own"; "cal"
   would put the picker back on Cal.com's API. */

/** The browser's choice: the build's engine, or `?ownbook`. */
export const ownEngine = () =>
  process.env.NEXT_PUBLIC_BOOKING_ENGINE === "own" || (typeof location !== "undefined" && new URLSearchParams(location.search).has("ownbook"));

/** The server's choice: the Worker's engine, or a request that asked for the site's own. */
export const ownOnServer = (env: { BOOKING_ENGINE?: string }, asked?: unknown) => env.BOOKING_ENGINE === "own" || asked === "own";

/** A visitor's booking, checked by `parseBooking` in `lib/deposit.ts`. */
export type Booking = {
  slug: string;
  /** ISO 8601, UTC. */
  start: string;
  timeZone: string;
  name: string;
  email: string;
  phone?: string;
  where?: string;
  notes?: string;
  /** "own": booked by the site's engine (`lib/booking-rules.ts`), not Cal.com. */
  engine?: "own";
};
