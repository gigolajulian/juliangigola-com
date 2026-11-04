import { EVENTS, TZ } from "@/lib/booking-rules";
import type { Booking } from "@/lib/deposit";
import { gcal } from "@/lib/gcal";
import { bookingEnquiry, enquiryKey, summary } from "@/lib/inbox";
import { toNotion } from "@/lib/notion-lead";
import { openNow } from "@/lib/slots";

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
 * is the site's own (`lib/confirm.ts`).
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

/** The record by its id. */
export const findBooking = (store: Store, id: string) => store.get<BookingRecord>(recKey(id));
export const saveBooking = (store: Store, r: BookingRecord) => store.put(recKey(r.id), r);
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
export async function bookOwn(store: Store, secret: string | undefined, b: BookInput): Promise<BookResult> {
  const rule = EVENTS[b.slug];
  if (!rule) return { ok: false, reason: "unknown" };
  // A deposit books once, however often Stripe delivers it.
  if (b.intent) {
    const had = await store.get<string>(intentKey(b.intent));
    const r = had && (await findBooking(store, had));
    if (r) return { ok: true, record: r };
  }
  if (!(await openNow(secret, b.slug, b.start))) return { ok: false, reason: "taken" };

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
 * The Inbox row and the Notion lead for a booking the site made, as
 * `app/api/cal` files Cal.com's. `deposit` is the Stripe link. Never
 * throws: the booking is made, a failed copy must not undo it.
 */
export async function recordLead(env: { INBOX?: CloudflareEnv["INBOX"]; NOTION_TOKEN?: string }, r: BookingRecord, deposit?: string) {
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
  await toNotion(env.NOTION_TOKEN, { stored, status: r.call ? "Call booked" : "Confirmed", kind: r.slug, calUid: r.id, shootDate: r.call ? undefined : r.start });
}

/* ── reaching the lock from a route ───────────────────────────── */

type LockEnv = { BOOKING_LOCK?: { idFromName(name: string): unknown; get(id: unknown): { fetch(url: string, init: RequestInit): Promise<Response> } } };

/** One call to the one lock (`worker/booking-lock.ts`). Throws when it is missing or fails. */
export async function lock<T>(env: LockEnv, op: string, arg: unknown): Promise<T> {
  const ns = env.BOOKING_LOCK;
  if (!ns) throw new Error("BOOKING_LOCK is not bound");
  const res = await ns.get(ns.idFromName("hello@")).fetch("https://lock/", { method: "POST", body: JSON.stringify({ op, arg }) });
  const out = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`booking lock ${op}: ${out.error ?? res.status}`);
  return out;
}
