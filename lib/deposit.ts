import { enquiry, enquiryKey, summary } from "@/lib/inbox";

/* ── the $100 deposit ─────────────────────────────────────────────
 * Julian (2026-10-16): the four paid sessions take a $100 deposit on the
 * site, in the site's own card, before Cal.com books the time. The order
 * is what keeps it honest: nothing is booked until Stripe says the money
 * arrived, so there are no unpaid holds.
 *
 *   1. POST /api/deposit checks the time is still open and creates a
 *      PaymentIntent. What to book rides on the intent's metadata, so an
 *      abandoned card costs no KV write.
 *   2. The visitor pays in the Stripe Payment Element.
 *   3. Stripe's signed webhook (`/api/stripe`) books Cal.com. If the time
 *      went in the meantime, or Cal.com refuses, the deposit is refunded
 *      at once. If even the refund fails, the Inbox gets a row saying so.
 *   4. The card polls GET /api/deposit/<id> for the outcome.
 *
 * Stripe is called over its REST API with fetch, no SDK: three calls do
 * not need a dependency. Test-mode keys until Julian says live.
 * ─────────────────────────────────────────────────────────────── */

/** Cal.com event slugs that take the deposit. */
export const PAID = ["portraits", "headshots", "graduation", "digitals"] as const;
export const AMOUNT = 10000;
export const CURRENCY = "usd";
const USER = "juliangigola";
const CAL = "https://api.cal.com/v2";
const STRIPE = "https://api.stripe.com/v1";
/** How old a webhook's timestamp may be before it is treated as a replay. */
const TOLERANCE_S = 300;

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

/** What GET /api/deposit/<id> reports. "booking" is internal: a webhook is on it. */
export type Status = "pending" | "booking" | "booked" | "refunded" | "failed";
export type DepositRecord = { status: Status; at: string; booking?: { uid: string; start: string } };

export const recordKey = (intent: string) => `deposit:${intent}`;
export const isIntentId = (s: string) => /^pi_[A-Za-z0-9]{8,64}$/.test(s);

const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
// Stripe caps a metadata value at 500 characters.
const cap = (s: unknown, n = 500) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** The visitor's booking, checked, or the reason it is not one. */
export function parseBooking(raw: unknown): Booking | string {
  const b = (raw ?? {}) as { [k: string]: unknown };
  const slug = cap(b.slug);
  if (!(PAID as readonly string[]).includes(slug)) return "Not a paid session.";
  const start = cap(b.start);
  const t = Date.parse(start);
  if (!start || isNaN(t) || t < Date.now()) return "Pick a time.";
  const timeZone = cap(b.timeZone, 64);
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    return "Unknown time zone.";
  }
  const name = cap(b.name, 120);
  const email = cap(b.email, 200);
  if (!name) return "Add your name.";
  if (!looksLikeEmail(email)) return "Check your email.";
  return {
    slug,
    start: new Date(t).toISOString(),
    timeZone,
    name,
    email,
    phone: cap(b.phone, 20) || undefined,
    where: cap(b.where) || undefined,
    notes: cap(b.notes) || undefined,
  };
}

const dayIn = (iso: string, tz: string, plus = 0) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(Date.parse(iso) + plus * 864e5));

/** Whether Cal.com still offers this start. */
export async function isOpen(b: Booking): Promise<boolean> {
  const q = new URLSearchParams({
    username: USER,
    eventTypeSlug: b.slug,
    start: dayIn(b.start, b.timeZone, -1),
    end: dayIn(b.start, b.timeZone, 1),
    timeZone: b.timeZone,
  });
  const res = await fetch(`${CAL}/slots?${q}`, { headers: { "cal-api-version": "2024-09-04" } });
  if (!res.ok) throw new Error(`Cal.com slots ${res.status}`);
  const { data } = (await res.json()) as { data?: { [day: string]: { start: string }[] } };
  const want = Date.parse(b.start);
  return Object.values(data ?? {}).some((day) => day.some((s) => Date.parse(s.start) === want));
}

/** Books the time on Cal.com, as the picker does from the browser. */
export async function bookCal(b: Booking): Promise<{ uid: string; start: string }> {
  const res = await fetch(`${CAL}/bookings`, {
    method: "POST",
    headers: { "cal-api-version": "2024-08-13", "Content-Type": "application/json" },
    body: JSON.stringify({
      start: b.start,
      eventTypeSlug: b.slug,
      username: USER,
      attendee: { name: b.name, email: b.email, timeZone: b.timeZone, language: "en", ...(b.phone ? { phoneNumber: b.phone } : {}) },
      ...(b.where ? { location: { type: "attendeeDefined", location: b.where } } : {}),
      bookingFieldsResponses: {
        notes: [b.phone ? `Phone: ${b.phone}` : "", "Deposit paid on the site.", b.notes ?? ""].filter(Boolean).join("\n"),
      },
    }),
  });
  const out = (await res.json().catch(() => ({}))) as { status?: string; data?: { uid?: string; start?: string } };
  if (!res.ok || out.status !== "success" || !out.data?.uid) throw new Error(`Cal.com booking ${res.status}`);
  return { uid: out.data.uid, start: out.data.start ?? b.start };
}

/** A call to Stripe's API, form-encoded as it expects. */
export async function stripe(key: string, path: string, form: { [k: string]: string }, idempotency?: string) {
  const res = await fetch(`${STRIPE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    body: new URLSearchParams(form),
  });
  const out = (await res.json().catch(() => ({}))) as { [k: string]: unknown };
  if (!res.ok) throw new Error(`Stripe ${path} ${res.status}`);
  return out;
}

/** The PaymentIntent's form, with the booking in its metadata. */
export function intentForm(b: Booking): { [k: string]: string } {
  const form: { [k: string]: string } = {
    amount: String(AMOUNT),
    currency: CURRENCY,
    "automatic_payment_methods[enabled]": "true",
    receipt_email: b.email,
    description: `Deposit: ${b.slug}, ${b.start}`,
  };
  for (const [k, v] of Object.entries(b)) if (v) form[`metadata[${k}]`] = v;
  return form;
}

/** The booking back out of an intent's metadata. */
export const fromMetadata = (m: { [k: string]: string } | undefined) => parseBooking(m ?? {});

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * Whether `Stripe-Signature` signs this body: `t=<unix>,v1=<hex>`, an
 * HMAC-SHA256 of `${t}.${body}` keyed with the endpoint's `whsec_` secret.
 * Old timestamps are refused so a captured request cannot be replayed.
 */
export async function verifyStripe(body: string, header: string, secret: string, now = Date.now()): Promise<boolean> {
  const parts = header.split(",").map((p) => p.split("="));
  const t = parts.find(([k]) => k === "t")?.[1] ?? "";
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!/^\d+$/.test(t) || !sigs.length || Math.abs(now / 1000 - +t) > TOLERANCE_S) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  // Same length hex strings, compared without stopping at the first difference.
  return sigs.some((s) => s.length === want.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ want.charCodeAt(i)), 0) === 0);
}

type Env = { INBOX: NonNullable<CloudflareEnv["INBOX"]>; STRIPE_SECRET_KEY: string };

/**
 * A paid intent becomes a booking, once. Stripe may deliver the same event
 * twice; the record makes every delivery after the first a no-op.
 * ponytail: KV is not a lock, so two deliveries in the same second could both
 * book. Stripe spaces its retries by minutes; a Durable Object if that changes.
 */
export async function settle(env: Env, intent: string, metadata: { [k: string]: string } | undefined): Promise<Status> {
  const key = recordKey(intent);
  const seen = await env.INBOX.get(key);
  if (seen) return (JSON.parse(seen) as DepositRecord).status;

  const put = (r: Omit<DepositRecord, "at">) => env.INBOX.put(key, JSON.stringify({ ...r, at: new Date().toISOString() }), { expirationTtl: 90 * 864e2 });
  await put({ status: "booking" });

  const b = fromMetadata(metadata);
  if (typeof b !== "string") {
    try {
      if (await isOpen(b)) {
        const booking = await bookCal(b);
        await put({ status: "booked", booking });
        return "booked";
      }
    } catch {
      // Falls through to the refund.
    }
  }

  try {
    await stripe(env.STRIPE_SECRET_KEY, "/refunds", { payment_intent: intent }, `refund-${intent}`);
    await put({ status: "refunded" });
    return "refunded";
  } catch {
    await put({ status: "failed" });
    const now = Date.now();
    const id = crypto.randomUUID();
    const who = typeof b === "string" ? { name: "Unknown", email: "" } : b;
    const row = {
      ...enquiry(
        {
          type: "other",
          name: who.name,
          email: who.email,
          detail: `Deposit paid, not booked, not refunded`,
          message: `A $100 deposit (${intent}) was paid, but Cal.com did not take the booking and the automatic refund failed. Refund it by hand in Stripe and email them.`,
        },
        now,
        id,
      ),
      type: "booking",
    };
    await env.INBOX.put(enquiryKey(now, id.slice(0, 8)), JSON.stringify(row), { metadata: summary(row) });
    return "failed";
  }
}
