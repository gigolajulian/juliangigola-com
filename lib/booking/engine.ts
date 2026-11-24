import { BOOKING_FEE, DEFAULT_HOURS, EVENTS, HEADS_UP_HOURS, MAX_MOVES, MOVE_HOURS, REFUND_HOURS, TZ, type Booking, type Hours } from "@/lib/booking/rules";
import { gcal } from "@/lib/booking/gcal";
import { bookingEnquiry, enquiryKey, looksLikeEmail, summary } from "@/lib/inbox";
import { takesDeposit, LEGACY_DEPOSIT } from "@/lib/booking/paid";
import { recordLead, type LeadStore } from "@/lib/leads/lead-store";
import { toNotion } from "@/lib/leads/sync/notion-lead";
import { openNow, type KV } from "@/lib/booking/slots";
import { statusOf } from "@/lib/http";

/* ── the site's own booking engine ────────────────────────────────
 * One Durable Object (`worker/booking-lock.ts`) runs every booking through
 * here one at a time: recheck hello@'s free/busy, insert the event,
 * keep the record. Two tabs on one slot: the second finds it busy.
 * KV could not do this, it is eventually consistent and has no lock.
 *
 * Google Calendar holds the time; the record (DO storage) holds what the
 * site needs after: the event id, the deposit, the reminder sent. The
 * event goes in with `sendUpdates=none`, so the only mail the client gets
 * is the site's own (`lib/booking/confirm.ts`).
 * ─────────────────────────────────────────────────────────────── */

export type BookingRecord = {
  /** Ours, in links: 16 url-safe characters. */
  id: string;
  eventId: string;
  slug: string;
  session: string;
  call?: boolean;
  /** ISO, UTC. */
  start: string;
  end: string;
  /** The start first booked; a reschedule never changes it (the refund rule reads it). */
  firstStart?: string;
  /** Times the client has moved it (`MAX_MOVES`). Unset on a record from before 2026-11-16: counted as none. */
  moves?: number;
  /** The percent kept on an early cancel (`BOOKING_FEE`). Unset on a booking made before the fee: a full refund then. */
  fee?: number;
  /** When the heads-up mail went out (`dueHeadsUp`). */
  headsUp?: string;
  timeZone: string;
  name: string;
  email: string;
  phone?: string;
  /** The address for a shoot, or the Meet link for a video call. */
  where?: string;
  notes?: string;
  via?: CallVia;
  /** The deposit's PaymentIntent. */
  intent?: string;
  /** What the deposit was, in dollars. Unset on a record made before 2026-11-15: $100 then (`depositPaid`). */
  deposit?: number;
  at: string;
  reminded?: string;
  cancelled?: string;
};

/** What the DO keeps its records in: its own storage, or a Map in tests. */
export type Store = {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  list<T>(opts: { prefix: string }): Promise<Map<string, T>>;
};

// Stripe caps a metadata value at 500 characters.
const cap = (s: unknown, n = 500) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** The visitor's booking, checked, or the reason it is not one. `call`: a free call (`app/api/book`), not a paid session. */
export type Parsed = { ok: true; booking: Booking } | { ok: false; reason: string };
export function parseBooking(raw: unknown, call = false): Parsed {
  const b = (raw ?? {}) as { [k: string]: unknown };
  const slug = cap(b.slug);
  if (call ? !EVENTS[slug]?.call : !takesDeposit(slug)) return { ok: false, reason: call ? "Not a call." : "Not a paid session." };
  const start = cap(b.start);
  const t = Date.parse(start);
  if (!start || isNaN(t) || t < Date.now()) return { ok: false, reason: "Pick a time." };
  const timeZone = cap(b.timeZone, 64);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    return { ok: false, reason: "Unknown time zone." };
  }
  const name = cap(b.name, 120);
  const email = cap(b.email, 200);
  if (!name) return { ok: false, reason: "Add your name." };
  if (!looksLikeEmail(email)) return { ok: false, reason: "Check your email." };
  const booking: Booking = {
    slug,
    start: new Date(t).toISOString(),
    timeZone,
    name,
    email,
    phone: cap(b.phone, 20) || undefined,
    where: cap(b.where) || undefined,
    notes: cap(b.notes) || undefined,
    engine: "own",
  };
  return { ok: true, booking };
}

/** How a free call is held: by video on its Meet link, or I ring the number. */
export type CallVia = "Phone" | "Video";
export type BookInput = Booking & { via?: CallVia; intent?: string; deposit?: number };
/** What a booking's deposit was, in dollars: as stored, or the $100 every earlier one paid. Nothing if it took none. */
export const depositPaid = (r: { intent?: string; deposit?: number }) => (r.intent ? (r.deposit ?? LEGACY_DEPOSIT) : undefined);
export type BookResult = { ok: true; record: BookingRecord } | { ok: false; reason: "taken" | "unknown" };

const recKey = (id: string) => `b:${id}`;
const intentKey = (intent: string) => `i:${intent}`;
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

/** What the client's page may show: no email, no phone, no deposit id. */
export const clientView = (r: BookingRecord) => ({ id: r.id, slug: r.slug, session: r.session, start: r.start, end: r.end, firstStart: r.firstStart, where: r.where, moves: r.moves ?? 0, fee: r.fee, paid: !!r.intent, deposit: depositPaid(r), cancelled: !!r.cancelled });

/** The record by its id. */
export const findBooking = (store: Store, id: string) => store.get<BookingRecord>(recKey(id));
export const saveBooking = (store: Store, r: BookingRecord) => store.put(recKey(r.id), r);
/** Julian's hours as set from the lead desk, or the defaults. */
export const readHours = async (store: Store) => (await store.get<Hours>("hours")) ?? DEFAULT_HOURS;
export const writeHours = (store: Store, h: Hours) => store.put("hours", h);
export const allBookings = async (store: Store) => [...(await store.list<BookingRecord>({ prefix: "b:" })).values()];

/** The event's text on hello@'s calendar: everything Julian needs at a glance. */
function description(b: BookInput, id: string) {
  return [
    `${b.name} <${b.email}>`,
    b.phone && `Phone: ${b.phone}`,
    b.via && `Call: ${b.via === "Phone" ? `ring ${b.phone ?? ""}`.trim() : "video"}`,
    b.where && `Where: ${b.where}`,
    b.notes && `\n${b.notes}`,
    b.intent && `\nDeposit paid on the site: $${depositPaid(b)} (ref ${b.intent}).`,
    `\nBooked on juliangigola.com, booking ${id}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Books `b` if its time is still open. Call it only through the lock. Throws when Google fails. */
export async function bookOwn(store: Store, secret: string | undefined, b: BookInput, kv?: KV): Promise<BookResult> {
  const rule = EVENTS[b.slug];
  if (!rule) return { ok: false, reason: "unknown" };
  // A deposit books once, however often Stripe delivers it.
  if (b.intent) {
    const had = await store.get<string>(intentKey(b.intent));
    const r = had && (await findBooking(store, had));
    if (r) return { ok: true, record: r };
  }
  if (!(await openNow(secret, b.slug, b.start, { kv, hours: await readHours(store) }))) return { ok: false, reason: "taken" };

  const id = newId();
  const end = new Date(Date.parse(b.start) + rule.length * 6e4).toISOString();
  const meet = rule.call && b.via !== "Phone";
  const ev = await gcal<{ id: string; hangoutLink?: string }>(
    secret,
    `/calendars/primary/events?sendUpdates=none${meet ? "&conferenceDataVersion=1" : ""}`,
    {
      body: {
        summary: `${rule.title}: ${b.name}`,
        description: description(b, id),
        start: { dateTime: b.start, timeZone: TZ },
        end: { dateTime: end, timeZone: TZ },
        attendees: [{ email: b.email, displayName: b.name }],
        ...(b.where ? { location: b.where } : {}),
        extendedProperties: { private: { jgBooking: id } },
        ...(meet ? { conferenceData: { createRequest: { requestId: id, conferenceSolutionKey: { type: "hangoutsMeet" } } } } : {}),
      },
    },
  );
  const record: BookingRecord = {
    id,
    eventId: ev.id,
    slug: b.slug,
    session: rule.title,
    ...(rule.call ? { call: true } : {}),
    start: new Date(b.start).toISOString(),
    end,
    firstStart: new Date(b.start).toISOString(),
    timeZone: b.timeZone,
    name: b.name,
    email: b.email,
    ...(b.phone ? { phone: b.phone } : {}),
    ...(meet && ev.hangoutLink ? { where: ev.hangoutLink } : b.where ? { where: b.where } : {}),
    ...(b.notes ? { notes: b.notes } : {}),
    ...(b.via ? { via: b.via } : {}),
    ...(b.intent ? { intent: b.intent } : {}),
    ...(b.intent && b.deposit ? { deposit: b.deposit } : {}),
    ...(b.intent ? { fee: BOOKING_FEE } : {}),
    at: new Date().toISOString(),
  };
  await saveBooking(store, record);
  if (b.intent) await store.put(intentKey(b.intent), id);
  return { ok: true, record };
}

/**
 * The Inbox row and the Notion lead for a booking the site made.
 * `deposit` is the Stripe link. Never
 * throws: the booking is made, a failed copy must not undo it.
 */
export async function recordBooking(env: LeadStore & { INBOX?: CloudflareEnv["INBOX"]; NOTION_TOKEN?: string }, r: BookingRecord, deposit?: string) {
  const now = Date.now();
  const id = crypto.randomUUID();
  const stored = bookingEnquiry(
    {
      type: r.slug,
      eventTitle: r.session,
      uid: r.id,
      startTime: r.start,
      endTime: r.end,
      location: r.where,
      additionalNotes: [r.phone && `Phone: ${r.phone}`, r.via && `Call: ${r.via}`, r.notes, `Booked on the site (${r.id}).`].filter(Boolean).join("\n"),
      attendees: [{ name: r.name, email: r.email }],
    },
    now,
    id,
  );
  if (deposit) Object.assign(stored, { deposit, depositUsd: depositPaid(r) });
  try {
    await env.INBOX?.put(enquiryKey(now, id.slice(0, 8)), JSON.stringify(stored), { metadata: summary(stored) });
  } catch (e) {
    console.error("booking inbox", String(e));
  }
  // The lead desk: the person's row moves to Call booked or Confirmed.
  await recordLead(env, r.email, { event: { at: r.at, kind: r.call ? "call" : "booking", ref: r.id, note: r.session }, name: r.name, kind: r.slug, when: r.start });
  await toNotion(env.NOTION_TOKEN, { stored, status: r.call ? "Call booked" : "Confirmed", kind: r.slug, calUid: r.id, shootDate: r.call ? undefined : r.start });
}

export type ChangeResult = { ok: true; record: BookingRecord; was: BookingRecord } | { ok: false; reason: "missing" | "past" | "cancelled" | "taken" | "moves" | "late" };

/** Cancels booking `id`: the event leaves hello@'s calendar, the record is marked. Call it only through the lock. */
export async function cancelOwn(store: Store, secret: string | undefined, id: string): Promise<ChangeResult> {
  const was = await findBooking(store, id);
  if (!was) return { ok: false, reason: "missing" };
  if (was.cancelled) return { ok: false, reason: "cancelled" };
  if (Date.parse(was.start) <= Date.now()) return { ok: false, reason: "past" };
  try {
    await gcal(secret, `/calendars/primary/events/${encodeURIComponent(was.eventId)}?sendUpdates=none`, { method: "DELETE" });
  } catch (e) {
    // Deleted by hand on the calendar already: the cancel still stands.
    const s = statusOf(e);
    if (s !== 404 && s !== 410) throw e;
  }
  const record = { ...was, cancelled: new Date().toISOString() };
  await saveBooking(store, record);
  return { ok: true, record, was };
}

/** Moves booking `id` to `start` if that time is open. Call it only through the lock. */
export async function rescheduleOwn(store: Store, secret: string | undefined, id: string, start: string, kv?: KV): Promise<ChangeResult> {
  const was = await findBooking(store, id);
  if (!was) return { ok: false, reason: "missing" };
  if (was.cancelled) return { ok: false, reason: "cancelled" };
  if (Date.parse(was.start) <= Date.now()) return { ok: false, reason: "past" };
  if ((was.moves ?? 0) >= MAX_MOVES) return { ok: false, reason: "moves" };
  // Inside the last day a slot cannot be sold again, so it no longer moves.
  if (Date.parse(was.start) - Date.now() < MOVE_HOURS * 36e5) return { ok: false, reason: "late" };
  const rule = EVENTS[was.slug];
  const t = Date.parse(start);
  if (!rule || isNaN(t) || !(await openNow(secret, was.slug, start, { mine: was, kv, hours: await readHours(store) }))) return { ok: false, reason: "taken" };
  const end = new Date(t + rule.length * 6e4).toISOString();
  await gcal(secret, `/calendars/primary/events/${encodeURIComponent(was.eventId)}?sendUpdates=none`, {
    method: "PATCH",
    body: { start: { dateTime: new Date(t).toISOString(), timeZone: TZ }, end: { dateTime: end, timeZone: TZ } },
  });
  // A moved booking is reminded again before its new time.
  const record: BookingRecord = { ...was, start: new Date(t).toISOString(), end, moves: (was.moves ?? 0) + 1 };
  delete record.reminded;
  delete record.headsUp;
  await saveBooking(store, record);
  return { ok: true, record, was };
}

/* Julian's plan (piece 5): a reminder 23 to 24 hours ahead, from an hourly
   cron. A booking made inside that last day already has its fresh "You're
   in." mail, so it gets none. */
const DAY = 864e5;

/** Bookings whose reminder is due at `now`: live, not reminded, starting within 24 hours, booked before that last day. A late or skipped run still catches them. */
export const dueReminders = async (store: Store, now = Date.now()) =>
  (await allBookings(store)).filter((r) => {
    const t = Date.parse(r.start);
    return !r.cancelled && !r.reminded && t > now && t - now <= DAY && Date.parse(r.at) <= t - DAY;
  });

/** Paid bookings whose heads-up is due at `now`: live, not sent, the early refund still open (over 48 hours
    before the time it is judged by), starting within 72 hours, booked before that. A run that comes late sends
    nothing rather than a claim that is no longer true. */
export const dueHeadsUp = async (store: Store, now = Date.now()) =>
  (await allBookings(store)).filter((r) => {
    const t = Date.parse(r.start);
    const judged = Math.min(t, Date.parse(r.firstStart ?? r.start));
    return !!r.intent && !r.cancelled && !r.headsUp && t - now <= HEADS_UP_HOURS * 36e5 && judged - now > REFUND_HOURS * 36e5 && Date.parse(r.at) <= t - HEADS_UP_HOURS * 36e5;
  });

/** Marks booking `id` as sent its heads-up. */
export async function markHeadsUp(store: Store, id: string, now = Date.now()) {
  const r = await findBooking(store, id);
  if (r) await saveBooking(store, { ...r, headsUp: new Date(now).toISOString() });
}

/** Marks booking `id` reminded. */
export async function markReminded(store: Store, id: string, now = Date.now()) {
  const r = await findBooking(store, id);
  if (r) await saveBooking(store, { ...r, reminded: new Date(now).toISOString() });
}

/* ── reaching the lock from a route ───────────────────────────── */

type LockEnv = { BOOKING_LOCK?: { idFromName(name: string): unknown; get(id: unknown): { fetch(url: string, init: RequestInit): Promise<Response> } } };

/** Julian's hours from the lock, or the defaults when it cannot answer (the lock rechecks every booking anyway). */
export const liveHours = (env: LockEnv) => lockOp(env, "hours", null).then((x) => x.hours, () => DEFAULT_HOURS);

/** Each op the lock answers (`worker/booking-lock.ts`): [argument, answer]. */
export type LockOps = {
  book: [BookInput, BookResult];
  cancel: [string, ChangeResult];
  reschedule: [{ id: string; start: string }, ChangeResult];
  due: [null, { records: BookingRecord[] }];
  reminded: [string, { ok: boolean }];
  dueHeads: [null, { records: BookingRecord[] }];
  headed: [string, { ok: boolean }];
  hours: [null, { hours: Hours }];
  setHours: [Hours, { hours: Hours }];
  get: [string, { record: BookingRecord | null }];
};

/** One call to the one lock (`worker/booking-lock.ts`). Throws when it is missing or fails. */
export async function lockOp<K extends keyof LockOps>(env: LockEnv, op: K, arg: LockOps[K][0]): Promise<LockOps[K][1]> {
  const ns = env.BOOKING_LOCK;
  if (!ns) throw new Error("BOOKING_LOCK is not bound");
  const res = await ns.get(ns.idFromName("hello@")).fetch("https://lock/", { method: "POST", body: JSON.stringify({ op, arg }) });
  if (!res.ok) {
    // A failing lock may answer plain text: keep the status when the body is not JSON.
    const out = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`booking lock ${op}: ${out.error ?? res.status}`);
  }
  return (await res.json()) as LockOps[K][1];
}
