import { DEFAULT_HOURS, EVENTS, TZ, windowOn, type Hours, type Rule } from "@/lib/booking/booking-rules";
import { gcal } from "@/lib/booking/gcal";

/* ── open times, from hello@'s free/busy ──────────────────────────
 * The rules (`lib/booking/booking-rules.ts`) say when Julian works; Google's
 * freeBusy says what is already taken, Cal.com's bookings included while
 * both engines run. A start is offered when the session and its buffer
 * after it touch nothing busy. `GET /api/slots` serves these to the picker
 * and `isOpen` rechecks one before money or a booking moves.
 * ─────────────────────────────────────────────────────────────── */

/** Calendars whose busy time blocks a booking. */
export const CALENDARS = ["primary"];
/* shortcut: freeBusy refuses long ranges, so it is asked in 60-day pieces. */
const PIECE = 60 * 864e5;

type Busy = { start: number; end: number; label?: string };

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
export function startsFor(rule: Rule, busy: Busy[], from: number, to: number, now = Date.now(), hours: Hours = DEFAULT_HOURS): number[] {
  const out: number[] = [];
  const earliest = Math.max(from, now + rule.notice * 6e4);
  const latest = Math.min(to, rule.ahead ? now + rule.ahead * 864e5 : Infinity);
  const step = (rule.interval ?? rule.length) * 6e4;
  // Day by day in Julian's time zone, from the day `earliest` falls on.
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(earliest).split("-").map(Number);
  for (let i = 0; ; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const open = windowOn(hours, day.toISOString().slice(0, 10), day.getUTCDay());
    const midnight = zoned(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), 0);
    if (midnight > latest) break;
    if (!open) continue;
    // The window's end is the last start, not the session's end.
    const close = zoned(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), open[1]);
    for (let s = zoned(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), open[0]); s <= close; s += step) {
      if (s < earliest || s >= latest) continue;
      const end = s + (rule.length + rule.after) * 6e4;
      if (!busy.some((b) => b.start < end && b.end > s - (rule.before ?? 0) * 6e4)) out.push(s);
    }
  }
  return out;
}

/* ── calendars read, never written ─────────────────────────────────
 * Julian (2026-11-04): "add other calendars to read off of". Each is a
 * Google calendar id shared to hello@ (free/busy is enough) or an ICS link,
 * kept in INBOX under `cal:extra` and edited from the Leads app's Calendar.
 * One that cannot be read is skipped and shown red there: a dead feed must
 * not close every booking. hello@'s own calendar still fails closed.
 * ─────────────────────────────────────────────────────────────── */

export type Extra = { label: string; src: string };
export const EXTRA_KEY = "cal:extra";
export type KV = { get(key: string, type: "json"): Promise<unknown> };
export const readExtras = async (kv?: KV) => ((await kv?.get(EXTRA_KEY, "json")) as Extra[] | null) ?? [];
export const isIcs = (src: string) => /^(https|webcal):\/\//i.test(src);

/** An ICS time: UTC with Z, else in its TZID (Pacific when none or unknown). */
function icsTime(v: string, params: string) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})\d{0,2}(Z?))?$/.exec(v.trim());
  if (!m) return NaN;
  const [y, mo, d, h, mi] = m.slice(1, 6).map((x) => +(x ?? 0));
  if (m[6]) return Date.UTC(y, mo - 1, d, h, mi);
  try {
    return zoned(y, mo, d, h * 60 + mi, /TZID="?([^;":]+)/.exec(params)?.[1] ?? TZ);
  } catch {
    // Outlook writes Windows zone names Intl does not know.
    return zoned(y, mo, d, h * 60 + mi);
  }
}

/* shortcut: an RRULE is read as its first time only; shift feeds list each
   shift. Expand RRULE if a recurring feed is ever added. */
/** The busy spans in an ICS feed: not cancelled, not marked free. Pure. */
export function icsBusy(text: string): Busy[] {
  const out: Busy[] = [];
  let ev: { [k: string]: [string, string] } | null = null;
  for (const line of text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/)) {
    if (line === "BEGIN:VEVENT") ev = {};
    else if (line === "END:VEVENT" && ev) {
      const [sp, sv] = ev.DTSTART ?? ["", ""];
      const start = icsTime(sv, sp);
      const d = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(ev.DURATION?.[1].trim() ?? "");
      const end = ev.DTEND
        ? icsTime(ev.DTEND[1], ev.DTEND[0])
        : d
          ? start + (((+(d[1] ?? 0) * 7 + +(d[2] ?? 0)) * 24 + +(d[3] ?? 0)) * 60 + +(d[4] ?? 0)) * 6e4
          : /^\d{8}$/.test(sv.trim())
            ? start + 864e5
            : start;
      if (ev.STATUS?.[1] !== "CANCELLED" && ev.TRANSP?.[1] !== "TRANSPARENT" && end > start) out.push({ start, end });
      ev = null;
    } else if (ev) {
      const i = line.indexOf(":");
      const [name, ...params] = line.slice(0, i).split(";");
      if (i > 0) ev[name] ??= [params.join(";"), line.slice(i + 1)];
    }
  }
  return out;
}

const feeds = new Map<string, { at: number; busy: Busy[] }>();
/* QA (#562): /api/slots is public and waits on every feed, so a feed gets
   2.5 seconds and its spans are kept five minutes, in this isolate and in
   the colo's cache (keyed by a hash: the link is private). */
const FEED_MS = 2500;
const edge = () => (globalThis as { caches?: { default?: Cache } }).caches?.default;
async function feedKey(src: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(src)));
  return new Request(`https://ics-cache.invalid/${[...h].map((b) => b.toString(16).padStart(2, "0")).join("")}`);
}
/** A feed's busy spans. Throws with the status only: the link is private. */
async function icsFeed(src: string) {
  const hit = feeds.get(src);
  if (hit && Date.now() - hit.at < 3e5) return hit.busy;
  const cache = edge();
  const key = cache && (await feedKey(src));
  const kept = key && (await cache.match(key));
  if (kept) {
    const busy = (await kept.json()) as Busy[];
    feeds.set(src, { at: Date.now(), busy });
    return busy;
  }
  const res = await fetch(src.replace(/^webcal:/i, "https:"), { signal: AbortSignal.timeout(FEED_MS) });
  if (!res.ok) throw new Error(`ICS ${res.status}`);
  const busy = icsBusy(await res.text());
  feeds.set(src, { at: Date.now(), busy });
  if (key) await cache.put(key, Response.json(busy, { headers: { "cache-control": "max-age=300" } })).catch(() => {});
  return busy;
}

/** What is busy between `from` and `to` on hello@ and every extra calendar, each span tagged with its calendar's label; `failed` lists extras that could not be read. */
export async function busyAll(secret: string | undefined, from: number, to: number, extras: Extra[] = []) {
  const failed = new Set<string>();
  const google = extras.filter((x) => !isIcs(x.src));
  const label = new Map(google.map((x) => [x.src, x.label]));
  const pieces: Promise<Busy[]>[] = [];
  for (let a = from; a < to; a += PIECE) {
    const b = Math.min(to, a + PIECE);
    pieces.push(
      gcal<{ calendars?: { [id: string]: { busy?: { start: string; end: string }[]; errors?: unknown[] } } }>(secret, "/freeBusy", {
        body: { timeMin: new Date(a).toISOString(), timeMax: new Date(b).toISOString(), items: [...CALENDARS, ...label.keys()].map((id) => ({ id })) },
      }).then((r) =>
        Object.entries(r.calendars ?? {}).flatMap(([id, c]) => {
          if (c.errors?.length) {
            // A calendar Google could not read is not a free one; an extra is skipped and flagged.
            if (!label.has(id)) throw new Error("freeBusy: a calendar could not be read");
            failed.add(label.get(id)!);
            return [];
          }
          return (c.busy ?? []).map((x) => ({ start: Date.parse(x.start), end: Date.parse(x.end), label: label.get(id) }));
        }),
      ),
    );
  }
  for (const x of extras.filter((x) => isIcs(x.src)))
    pieces.push(
      icsFeed(x.src).then(
        (busy) => busy.filter((b) => b.start < to && b.end > from).map((b) => ({ ...b, label: x.label })),
        () => (failed.add(x.label), []),
      ),
    );
  pieces.push(shiftDays(secret, from, to));
  return { busy: (await Promise.all(pieces)).flat(), failed: [...failed] };
}

/** Julian (2026-11-04): "when i work sgh, dont let them book me at all". Any day with an SGH event on it is busy from midnight to midnight Pacific, even when the shift itself is only the afternoon. */
async function shiftDays(secret: string | undefined, from: number, to: number): Promise<Busy[]> {
  type When = { date?: string; dateTime?: string };
  const q = new URLSearchParams({ q: "SGH", singleEvents: "true", maxResults: "2500", timeMin: new Date(from - 864e5).toISOString(), timeMax: new Date(to + 864e5).toISOString() });
  const r = await gcal<{ items?: { summary?: string; status?: string; start?: When; end?: When }[] }>(secret, `/calendars/primary/events?${q}`);
  // The Pacific midnight of the day `w` falls on; an all-day end date is already the day after.
  const midnight = (w: When, after: boolean) => {
    const [y, m, d] = (w.date ?? new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(Date.parse(w.dateTime!))).split("-").map(Number);
    return zoned(y, m, d + (after && !w.date ? 1 : 0), 0);
  };
  return (r.items ?? [])
    .filter((e) => e.status !== "cancelled" && /\bSGH\b/i.test(e.summary ?? "") && e.start && e.end)
    .map((e) => ({ start: midnight(e.start!, false), end: midnight(e.end!, true) }));
}

/** What is busy between `from` and `to`, on hello@ and the extras in `kv`. */
export async function busyBetween(secret: string | undefined, from: number, to: number, kv?: KV): Promise<Busy[]> {
  const { busy, failed } = await busyAll(secret, from, to, await readExtras(kv));
  if (failed.length) console.error("calendars skipped", failed.length);
  return busy;
}

/** Open starts of `slug` between `from` and `to`, as UTC ms. `mine`: a booking being moved, whose own time is not in the way. `kv`: where the extra calendars are listed. */
export async function openStarts(secret: string | undefined, slug: string, from: number, to: number, now = Date.now(), mine?: { start: string; end: string }, kv?: KV, hours?: Hours) {
  const rule = EVENTS[slug];
  if (!rule) return [];
  // The buffer after a session reaches past `to`.
  const busy = (await busyBetween(secret, Math.max(from, now) - (rule.before ?? 0) * 6e4, to + (rule.length + rule.after) * 6e4, kv)).filter(
    (b) => !mine || b.start !== Date.parse(mine.start) || b.end !== Date.parse(mine.end),
  );
  return startsFor(rule, busy, from, to, now, hours);
}

/** Whether `start` (ISO) is still open for `slug`, asking Google now. */
export async function openNow(secret: string | undefined, slug: string, start: string, mine?: { start: string; end: string }, kv?: KV, hours?: Hours) {
  const t = Date.parse(start);
  return (await openStarts(secret, slug, t - 864e5, t + 864e5, Date.now(), mine, kv, hours)).includes(t);
}
