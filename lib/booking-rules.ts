/* ── when Julian can be booked, for the site's own engine ──────────
 * Copied from Cal.com on 2026-11-03 (its public event types and the
 * slots it offered): Wednesday to Sunday, 10 AM to 6 PM Pacific, nothing
 * Monday or Tuesday. Edit here; the calendar on hello@ does the rest.
 * Client-safe: no server imports.
 * ─────────────────────────────────────────────────────────────── */

export const TZ = "America/Los_Angeles";

/** Open hours per weekday (0 Sunday), minutes after midnight Pacific; null is closed. */
export const HOURS: (readonly [number, number] | null)[] = [
  [600, 1080],
  null,
  null,
  [600, 1080],
  [600, 1080],
  [600, 1080],
  [600, 1080],
];

export type Rule = {
  title: string;
  /** Minutes. */
  length: number;
  /** Minutes between now and the earliest start. */
  notice: number;
  /** Minutes kept free after the session. */
  after: number;
  /** Minutes between offered starts; the length when unset, as Cal.com does. */
  interval?: number;
  /** How many days ahead may be booked; unset, the picker's own reach. */
  ahead?: number;
  /** A call (Meet or phone), not a shoot. */
  call?: boolean;
};

const SHOOT = { notice: 2880, after: 30, ahead: 180 };
const CALL = { length: 15, after: 0, interval: 30, call: true };

/** Every bookable event, by its Cal.com slug. */
export const EVENTS: Record<string, Rule> = {
  portraits: { title: "Portraits", length: 60, ...SHOOT },
  headshots: { title: "Headshots", length: 30, ...SHOOT },
  graduation: { title: "Graduation photos", length: 90, ...SHOOT },
  digitals: { title: "Studio digitals", length: 45, ...SHOOT },
  editorial: { title: "Editorial call", notice: 1440, ahead: 180, ...CALL },
  campaign: { title: "Brand & Campaign Call", notice: 1440, ahead: 180, ...CALL },
  "music-call": { title: "Music call", notice: 120, ...CALL },
  "wedding-call": { title: "Wedding call", notice: 120, ...CALL },
};

/** Julian (2026-11-03): a cancel this many hours or more before the start refunds the $100; under it, none. */
export const REFUND_HOURS = 48;
export const refundable = (r: { intent?: string; start: string }, now = Date.now()) => !!r.intent && Date.parse(r.start) - now >= REFUND_HOURS * 36e5;

/* Julian (2026-11-03): the engine stays Cal.com until he cuts over. `?ownbook`
   on the address tries the site's own in the browser; the build's
   NEXT_PUBLIC_BOOKING_ENGINE (.env.production) and the Worker's
   BOOKING_ENGINE (wrangler.jsonc) flip together at cutover. */

/** The browser's choice: the build's engine, or `?ownbook`. */
export const ownEngine = () =>
  process.env.NEXT_PUBLIC_BOOKING_ENGINE === "own" || (typeof location !== "undefined" && new URLSearchParams(location.search).has("ownbook"));

/** The server's choice: the Worker's engine, or a request that asked for the site's own. */
export const ownOnServer = (env: { BOOKING_ENGINE?: string }, asked?: unknown) => env.BOOKING_ENGINE === "own" || asked === "own";
