import { EVENTS, HOURS, TZ, type Rule } from "@/lib/booking-rules";
import { gcal } from "@/lib/gcal";

/* ── open times, from hello@'s free/busy ──────────────────────────
 * The rules (`lib/booking-rules.ts`) say when Julian works; Google's
 * freeBusy says what is already taken, Cal.com's bookings included while
 * both engines run. A start is offered when the session and its buffer
 * after it touch nothing busy. `GET /api/slots` serves these to the picker
 * and `isOpen` rechecks one before money or a booking moves.
 * ─────────────────────────────────────────────────────────────── */

/** Calendars whose busy time blocks a booking. */
export const CALENDARS = ["primary"];
/* shortcut: freeBusy refuses long ranges, so it is asked in 60-day pieces. */
const PIECE = 60 * 864e5;

type Busy = { start: number; end: number };

/** How far `tz` is ahead of UTC at `ms`, in ms. */
function offset(ms: number, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(ms)
      .map((x) => [x.type, +x.value]),
  );
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
}

/** The instant of `min` minutes after midnight on `y-m-d` in `tz`. */
export function zoned(y: number, m: number, d: number, min: number, tz = TZ) {
  const guess = Date.UTC(y, m - 1, d, 0, min);
  const first = guess - offset(guess, tz);
  // Across a clock change the second guess is the right side of it.
  return guess - offset(first, tz);
}

/** `2026-11-04T10:00:00-08:00`: the instant written in `tz`, as Cal.com writes its slots. */
export function localIso(ms: number, tz: string) {
  const off = offset(ms, tz) / 6e4;
  const t = new Date(ms + off * 6e4).toISOString().slice(0, 19);
  const a = Math.abs(off);
  return `${t}${off < 0 ? "-" : "+"}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

/** Every open start of `rule` between `from` and `to`, given what is busy. Pure. */
export function startsFor(rule: Rule, busy: Busy[], from: number, to: number, now = Date.now()): number[] {
  const out: number[] = [];
  const earliest = Math.max(from, now + rule.notice * 6e4);
  const latest = Math.min(to, rule.ahead ? now + rule.ahead * 864e5 : Infinity);
  const step = (rule.interval ?? rule.length) * 6e4;
  // Day by day in Julian's time zone, from the day `earliest` falls on.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(earliest).split("-").map(Number);
  for (let i = 0; ; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const open = HOURS[day.getUTCDay()];
    const midnight = zoned(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), 0);
    if (midnight > latest) break;
    if (!open) continue;
    const close = zoned(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), open[1]);
    for (let s = zoned(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), open[0]); s + rule.length * 6e4 <= close; s += step) {
      if (s < earliest || s >= latest) continue;
      const end = s + (rule.length + rule.after) * 6e4;
      if (!busy.some((b) => b.start < end && b.end > s)) out.push(s);
    }
  }
  return out;
}

/** What is busy on hello@'s calendars between `from` and `to`. */
export async function busyBetween(secret: string | undefined, from: number, to: number): Promise<Busy[]> {
  const pieces: Promise<Busy[]>[] = [];
  for (let a = from; a < to; a += PIECE) {
    const b = Math.min(to, a + PIECE);
    pieces.push(
      gcal<{ calendars?: { [id: string]: { busy?: { start: string; end: string }[]; errors?: unknown[] } } }>(secret, "/freeBusy", {
        body: { timeMin: new Date(a).toISOString(), timeMax: new Date(b).toISOString(), items: CALENDARS.map((id) => ({ id })) },
      }).then((r) =>
        Object.values(r.calendars ?? {}).flatMap((c) => {
          // A calendar Google could not read is not a free one.
          if (c.errors?.length) throw new Error("freeBusy: a calendar could not be read");
          return (c.busy ?? []).map((x) => ({ start: Date.parse(x.start), end: Date.parse(x.end) }));
        }),
      ),
    );
  }
  return (await Promise.all(pieces)).flat();
}

/** Open starts of `slug` between `from` and `to`, as UTC ms. `mine`: a booking being moved, whose own time is not in the way. */
export async function openStarts(secret: string | undefined, slug: string, from: number, to: number, now = Date.now(), mine?: { start: string; end: string }) {
  const rule = EVENTS[slug];
  if (!rule) return [];
  // The buffer after a session reaches past `to`.
  const busy = (await busyBetween(secret, Math.max(from, now), to + (rule.length + rule.after) * 6e4)).filter(
    (b) => !mine || b.start !== Date.parse(mine.start) || b.end !== Date.parse(mine.end),
  );
  return startsFor(rule, busy, from, to, now);
}

/** Whether `start` (ISO) is still open for `slug`, asking Google now. */
export async function openNow(secret: string | undefined, slug: string, start: string, mine?: { start: string; end: string }) {
  const t = Date.parse(start);
  return (await openStarts(secret, slug, t - 864e5, t + 864e5, Date.now(), mine)).includes(t);
}
