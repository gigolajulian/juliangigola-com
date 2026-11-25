/* ── when Julian can be booked, for the site's own engine ──────────
 * Wednesday to Sunday from 10 AM Pacific, nothing
 * Monday or Tuesday. The last start is 7 PM. These are the defaults: Julian changes the week and
 * single dates from the lead desk (Hours), kept in the booking lock.
 * Client-safe: no server imports.
 * ─────────────────────────────────────────────────────────────── */

/** "60 minutes", "2 hours": the card and the confirmation mail say it the same way. */
export const duration = (min: number) => (min >= 120 ? `${min / 60} hours` : `${min} minutes`);

/** Minutes after midnight Pacific: the first start, the last start. */
export type Window = readonly [number, number];

/** Open hours per weekday (0 Sunday), minutes after midnight Pacific; null is closed. */
export const HOURS: (Window | null)[] = [[600, 1140], null, null, [600, 1140], [600, 1140], [600, 1140], [600, 1140]];

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
  /** Minutes between offered starts; the length when unset. */
  interval?: number;
  /** How many days ahead may be booked; unset, the picker's own reach. */
  ahead?: number;
  /** A call (Meet or phone), not a shoot. */
  call?: boolean;
};

/* An hour each side of a shoot, to travel between locations on the same day. */
const SHOOT = { notice: 2880, before: 60, after: 60, ahead: 180 };
const CALL = { length: 15, after: 0, interval: 30, call: true };

/** Every bookable event, by its slug: the part after the slash in a session's `cal` ("juliangigola/portraits"). */
export const EVENTS: Record<string, Rule> = {
  portraits: { title: "Portraits", length: 60, ...SHOOT },
  headshots: { title: "Headshots", length: 45, ...SHOOT },
  graduation: { title: "Graduation photos", length: 90, ...SHOOT },
  digitals: { title: "Studio digitals", length: 45, ...SHOOT },
  "model-test": { title: "Model test", length: 60, ...SHOOT },
  editorial: { title: "Editorial call", notice: 1440, ahead: 180, ...CALL },
  campaign: { title: "Brand & Campaign Call", notice: 1440, ahead: 180, ...CALL },
  consultation: { title: "Consultation", notice: 120, ...CALL },
  "music-call": { title: "Music call", notice: 120, ...CALL },
  "wedding-call": { title: "Wedding call", notice: 120, ...CALL },
};

/** A cancel 48 hours or more before the start refunds 90% of the deposit
    (10% is the booking fee: no refund is free, and it covers Stripe's own fee, which a refund does
    not return), 24 hours or more refunds 70%, under 24 hours none. A booking made before the fee
    (no `fee` on its record) was sold a full refund and keeps it. */
export const REFUND_HOURS = 48;
export const PART_HOURS = 24;
export const EARLY_SHARE = 0.9;
export const PART_SHARE = 0.7;
/** The percent kept on an early cancel, stamped on each new paid booking's record. */
export const BOOKING_FEE = 10;
/** A booking can be moved until this many hours before it starts. */
export const MOVE_HOURS = 24;
/** The heads-up mail goes out this many hours ahead, while the early refund is still open. */
export const HEADS_UP_HOURS = 72;
/* The share of the deposit a cancel returns now: 0.9 (1 before the fee), 0.7 or 0. Julian
   (2026-11-03, "refund by first time"): judged against the time first booked,
   so moving a session out and then cancelling does not earn a better refund.
   A session moved earlier is judged by its new, earlier time. */
export const refundShare = (r: { intent?: string; start: string; firstStart?: string; fee?: number }, now = Date.now()): number => {
  if (!r.intent) return 0;
  const hours = (Math.min(Date.parse(r.start), Date.parse(r.firstStart ?? r.start)) - now) / 36e5;
  return hours >= REFUND_HOURS ? (r.fee ? EARLY_SHARE : 1) : hours >= PART_HOURS ? PART_SHARE : 0;
};
/** A client may move a booking this many times; after that it stays or is cancelled. */
export const MAX_MOVES = 2;
/** The cents a cancel returns of a deposit of `usd` dollars. */
// shortcut: the mails and screens print the dollars raw, whole only while every deposit divides by 10; format cents if one stops.
export const refundCents = (usd: number, share: number) => Math.round(usd * 100 * share);

/** A visitor's booking, checked by `parseBooking` in `lib/booking/engine.ts`. */
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
};
