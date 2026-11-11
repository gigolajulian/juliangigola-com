import { DEFAULT_HOURS, EVENTS, TZ, type Booking, type Hours } from "@/lib/booking/booking-rules";
import { gcal } from "@/lib/booking/gcal";
import { bookingEnquiry, enquiryKey, summary } from "@/lib/inbox";
import { recordLead, type LeadStore } from "@/lib/leads/lead-store";
import { openNow, type KV } from "@/lib/booking/slots";

/* ── the site's own booking engine ────────────────────────────────
 * Julian (2026-11-03): in place of Cal.com (PLAN-own-booking.md). One
 * Durable Object (`worker/booking-lock.ts`) runs every booking through
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
  timeZone: string;
  name: string;
  email: string;
  phone?: string;
  /** The address for a shoot, or the Meet link for a video call. */
  where?: string;
  notes?: string;
  /** "Phone" or "Video", for a call. */
  via?: string;
  /** The deposit's PaymentIntent. */
  intent?: string;
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

export type BookInput = Booking & { via?: string; intent?: string };
export type BookResult = { ok: true; record: BookingRecord } | { ok: false; reason: "taken" | "unknown" };

const recKey = (id: string) => `b:${id}`;
const intentKey = (intent: string) => `i:${intent}`;
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

/** What the client's page may show: no email, no phone, no deposit id. */
export const clientView = (r: BookingRecord) => ({ id: r.id, slug: r.slug, session: r.session, start: r.start, end: r.end, firstStart: r.firstStart, where: r.where, paid: !!r.intent, cancelled: !!r.cancelled });

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
    b.intent && `\nDeposit paid on the site: $100 (ref ${b.intent}).`,
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
    at: new Date().toISOString(),
  };
  await saveBooking(store, record);
  if (b.intent) await store.put(intentKey(b.intent), id);
  return { ok: true, record };
}

/**
 * The Inbox row and the lead for a booking the site made.
 * `deposit` is the Stripe link. Never
 * throws: the booking is made, a failed copy must not undo it.
 */
export async function recordBooking(env: LeadStore & { INBOX?: CloudflareEnv["INBOX"] }, r: BookingRecord, deposit?: string) {
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
  if (deposit) stored.deposit = deposit;
  try {
    await env.INBOX?.put(enquiryKey(now, id.slice(0, 8)), JSON.stringify(stored), { metadata: summary(stored) });
  } catch (e) {
    console.error("booking inbox", String(e));
  }
  // The lead desk: the person's row moves to Call booked or Confirmed.
  await recordLead(env, r.email, { event: { at: r.at, kind: r.call ? "call" : "booking", ref: r.id, note: r.session }, name: r.name, kind: r.slug, when: r.start });
}

export type ChangeResult = { ok: true; record: BookingRecord; was: BookingRecord } | { ok: false; reason: "missing" | "past" | "cancelled" | "taken" };

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
    const s = (e as { status?: number }).status;
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
  const rule = EVENTS[was.slug];
  const t = Date.parse(start);
  if (!rule || isNaN(t) || !(await openNow(secret, was.slug, start, { mine: was, kv, hours: await readHours(store) }))) return { ok: false, reason: "taken" };
  const end = new Date(t + rule.length * 6e4).toISOString();
  await gcal(secret, `/calendars/primary/events/${encodeURIComponent(was.eventId)}?sendUpdates=none`, {
    method: "PATCH",
    body: { start: { dateTime: new Date(t).toISOString(), timeZone: TZ }, end: { dateTime: end, timeZone: TZ } },
  });
  // A moved booking is reminded again before its new time.
  const record: BookingRecord = { ...was, start: new Date(t).toISOString(), end };
  delete record.reminded;
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

/** Marks booking `id` reminded. */
export async function markReminded(store: Store, id: string, now = Date.now()) {
  const r = await findBooking(store, id);
  if (r) await saveBooking(store, { ...r, reminded: new Date(now).toISOString() });
}

/* ── reaching the lock from a route ───────────────────────────── */

type LockEnv = { BOOKING_LOCK?: { idFromName(name: string): unknown; get(id: unknown): { fetch(url: string, init: RequestInit): Promise<Response> } } };

/** Julian's hours from the lock, or the defaults when it cannot answer (the lock rechecks every booking anyway). */
export const liveHours = (env: LockEnv) => lock(env, "hours", null).then((x) => x.hours, () => DEFAULT_HOURS);

/** Each op the lock answers (`worker/booking-lock.ts`): [argument, answer]. */
export type LockOps = {
  book: [BookInput, BookResult];
  cancel: [string, ChangeResult];
  reschedule: [{ id: string; start: string }, ChangeResult];
  due: [null, { records: BookingRecord[] }];
  reminded: [string, { ok: boolean }];
  hours: [null, { hours: Hours }];
  setHours: [Hours, { hours: Hours }];
  get: [string, { record: BookingRecord | null }];
};

/** One call to the one lock (`worker/booking-lock.ts`). Throws when it is missing or fails. */
export async function lock<K extends keyof LockOps>(env: LockEnv, op: K, arg: LockOps[K][0]): Promise<LockOps[K][1]> {
  const ns = env.BOOKING_LOCK;
  if (!ns) throw new Error("BOOKING_LOCK is not bound");
  const res = await ns.get(ns.idFromName("hello@")).fetch("https://lock/", { method: "POST", body: JSON.stringify({ op, arg }) });
  const out = (await res.json()) as LockOps[K][1] & { error?: string };
  if (!res.ok) throw new Error(`booking lock ${op}: ${out.error ?? res.status}`);
  return out;
}
