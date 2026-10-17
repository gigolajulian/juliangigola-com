import { sendConfirm } from "@/lib/confirm";
import { enquiry, enquiryKey, summary, whenPT } from "@/lib/inbox";

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
 *   4. The card polls GET /api/deposit/<id> for the outcome. The webhook
 *      copies it onto the intent's metadata and the poll reads it from
 *      Stripe: KV caches a miss for up to a minute at the visitor's
 *      location, so the card read "pending" after the booking was made
 *      (QA, 2026-10-16).
 *   5. Julian (2026-10-16) hears about it: hello@ gets a mail for every
 *      deposit booked, refunded, or paid and stuck. The Cal.com booking
 *      carries the intent id (metadata, and a ref in the notes). When
 *      Cal.com's own webhook stores the booking, `paidFor` asks Stripe
 *      whether that intent really paid for this booking before the Inbox
 *      row says "Deposit paid": anyone can type a ref into their notes.
 *      The client's receipt is Stripe's, from `receipt_email`, and the
 *      site's own confirmation (`lib/confirm.ts`) once Cal.com books.
 *
 * Stripe is called over its REST API with fetch, no SDK: three calls do
 * not need a dependency. Test-mode keys until Julian says live.
 * ─────────────────────────────────────────────────────────────── */

/** Cal.com event slugs that take the deposit. */
import { PAID } from "@/lib/paid";
export { PAID };
export const AMOUNT = 10000;
export const CURRENCY = "usd";
export const KIND = "deposit";

/** Whether a paid intent is one of the site's deposits, not any other payment on the account. */
export const isDeposit = (pi: { amount?: number; currency?: string; metadata?: { [k: string]: string } }) =>
  pi.metadata?.kind === KIND && pi.amount === AMOUNT && pi.currency === CURRENCY;
const USER = "juliangigola";
const CAL = "https://api.cal.com/v2";
const STRIPE = "https://api.stripe.com/v1";
/** How old a webhook's timestamp may be before it is treated as a replay. */
const TOLERANCE_S = 300;
const MAIL_TO = "hello@juliangigola.com";
const MAIL_FROM = "enquiries@notifications.juliangigola.com";
export const SESSION: { [slug: string]: string } = { portraits: "Portraits", headshots: "Headshots", graduation: "Graduation photos", digitals: "Studio digitals" };

/** The intent in Stripe's dashboard, test or live as the key is. */
export const dashboardLink = (intent: string, key: string) =>
  `https://dashboard.stripe.com/${/_live_/.test(key) ? "" : "test/"}payments/${intent}`;

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
export async function bookCal(b: Booking, intent: string): Promise<{ uid: string; start: string; end?: string }> {
  const res = await fetch(`${CAL}/bookings`, {
    method: "POST",
    headers: { "cal-api-version": "2024-08-13", "Content-Type": "application/json" },
    body: JSON.stringify({
      start: b.start,
      eventTypeSlug: b.slug,
      username: USER,
      attendee: { name: b.name, email: b.email, timeZone: b.timeZone, language: "en", ...(b.phone ? { phoneNumber: b.phone } : {}) },
      ...(b.where ? { location: { type: "attendeeDefined", location: b.where } } : {}),
      metadata: { deposit: intent },
      bookingFieldsResponses: {
        notes: [b.phone ? `Phone: ${b.phone}` : "", `Deposit paid on the site: $100 (ref ${intent}).`, b.notes ?? ""].filter(Boolean).join("\n"),
      },
    }),
  });
  const out = (await res.json().catch(() => ({}))) as { status?: string; data?: { uid?: string; start?: string; end?: string } };
  if (!res.ok || out.status !== "success" || !out.data?.uid) throw new Error(`Cal.com booking ${res.status}`);
  return { uid: out.data.uid, start: out.data.start ?? b.start, end: out.data.end };
}

/** A call to Stripe's API: a form-encoded POST, or a GET without a form. */
export async function stripe(key: string, path: string, form?: { [k: string]: string }, idempotency?: string) {
  const res = await fetch(`${STRIPE}${path}`, {
    method: form ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // The account default (2026-09-30) rejects payment_method_types; pin a version that keeps card-only intents.
      "Stripe-Version": "2025-09-30.clover",
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const out = (await res.json().catch(() => ({}))) as { [k: string]: unknown };
  if (!res.ok) {
    const err = out.error as { type?: string; code?: string; message?: string } | undefined;
    console.error("stripe", path, res.status, err?.type, err?.code, err?.message);
    throw new Error(`Stripe ${path} ${res.status}`);
  }
  return out;
}

/** The PaymentIntent's form, with the booking in its metadata. */
export function intentForm(b: Booking): { [k: string]: string } {
  const form: { [k: string]: string } = {
    amount: String(AMOUNT),
    currency: CURRENCY,
    // Card only, to match the card's deferred-intent Elements. Apple Pay and
    // Google Pay ride on card.
    "payment_method_types[]": "card",
    receipt_email: b.email,
    description: `Deposit: ${b.slug}, ${b.start}`,
  };
  for (const [k, v] of Object.entries(b)) if (v) form[`metadata[${k}]`] = v;
  // Marks the site's own intents: the webhook leaves every other payment
  // on the account (Cal.com's, invoices, payment links) alone.
  form["metadata[kind]"] = KIND;
  return form;
}

/**
 * The Stripe link of the deposit that paid for this Cal.com booking;
 * `undefined` when there is none; `false` when Stripe could not be asked,
 * so a real deposit is never called missing (QA on #192). Only an intent
 * Stripe says succeeded, that is one of the site's deposits, and that was
 * made for this booking's email and start counts.
 */
export async function paidFor(key: string, p: { startTime?: string; attendees?: { email?: string }[]; additionalNotes?: string; metadata?: { [k: string]: unknown } }) {
  const ref = typeof p.metadata?.deposit === "string" ? p.metadata.deposit : p.additionalNotes?.match(/\bpi_[A-Za-z0-9]{8,64}\b/)?.[0];
  if (!ref || !isIntentId(ref)) return undefined;
  try {
    const pi = (await stripe(key, `/payment_intents/${ref}`)) as { status?: string; amount?: number; currency?: string; metadata?: { [k: string]: string } };
    const m = pi.metadata ?? {};
    const same = m.email?.toLowerCase() === p.attendees?.[0]?.email?.toLowerCase() && Date.parse(m.start ?? "") === Date.parse(p.startTime ?? "");
    return pi.status === "succeeded" && isDeposit(pi) && same ? dashboardLink(ref, key) : undefined;
  } catch (e) {
    // Stripe has no such intent: a made-up ref, so no deposit. Anything else: unknown.
    return String(e).endsWith(" 404") ? undefined : false;
  }
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

type Env = { INBOX: NonNullable<CloudflareEnv["INBOX"]>; STRIPE_SECRET_KEY: string; EMAIL?: CloudflareEnv["EMAIL"]; CLIENT_EMAIL?: CloudflareEnv["CLIENT_EMAIL"] };

/** "Visa ending 4242", from the charge; nothing if Stripe will not say. */
async function cardOf(key: string, intent: string) {
  try {
    const pi = (await stripe(key, `/payment_intents/${intent}?expand[]=latest_charge`)) as { latest_charge?: { payment_method_details?: { card?: { brand?: string; last4?: string } } } };
    const c = pi.latest_charge?.payment_method_details?.card;
    return c?.last4 ? `${c.brand ? c.brand[0].toUpperCase() + c.brand.slice(1) : "Card"} ending ${c.last4}` : undefined;
  } catch {
    return undefined;
  }
}

const SAID = { booked: "Deposit paid", refunded: "Deposit refunded", failed: "Deposit paid, not booked, not refunded" } as const;
const NEXT = {
  booked: "Booked on Cal.com.",
  refunded: "The time was gone or Cal.com refused the booking, so Stripe refunded them. Nothing is booked.",
  failed: "Cal.com did not take the booking and the automatic refund failed. Refund it by hand in Stripe and email them.",
};

/** A plain mail to hello@ saying how a deposit ended. A failed send is logged, never a failed webhook. */
async function mail(email: Env["EMAIL"], subject: string, lines: string[], who?: { name: string; email: string }) {
  try {
    await email?.send({
      to: MAIL_TO,
      from: { name: "Julian Gigola website", email: MAIL_FROM },
      subject,
      text: [...lines, "", "Inbox: https://juliangigola.com/admin"].join("\n"),
      ...(who?.email ? { replyTo: who } : {}),
    });
  } catch (e) {
    console.error("deposit mail", subject.split(":")[0], String(e));
  }
}

async function tell(env: Env, status: keyof typeof SAID, b: Booking | string, link: string) {
  const who = typeof b === "string" ? undefined : b;
  const what = who ? [SESSION[who.slug] ?? who.slug, whenPT(who.start), who.name, "$100"].join(", ") : "$100";
  await mail(env.EMAIL, `${SAID[status]}: ${what}`, [who ? `${who.name} <${who.email}>` : "Unknown client", NEXT[status], `Stripe: ${link}`], who);
}

/**
 * Julian (2026-10-16): Cal.com is $0, so its public page books a paid
 * session with no deposit. Such a booking is flagged, not stopped: a mail
 * to hello@ so he can cancel it or ask for the $100.
 */
export async function tellNoDeposit(email: Env["EMAIL"], slug: string, start: string | undefined, who: { name: string; email: string }) {
  await mail(email, `Booked without a deposit: ${[SESSION[slug] ?? slug, whenPT(start), who.name].join(", ")}`, [
    `${who.name} <${who.email}>`,
    "Stripe confirms no deposit for this booking, so it most likely came through cal.com directly. Cancel it in Cal.com or ask them for the $100.",
  ], who);
}

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

  const put = async (r: Omit<DepositRecord, "at">) => {
    await env.INBOX.put(key, JSON.stringify({ ...r, at: new Date().toISOString() }), { expirationTtl: 90 * 864e2 });
    if (r.status === "booking") return;
    // The card's copy (see 4. above). A failed copy only leaves the card on
    // "Still confirming"; it must never turn a booking into a refund.
    const form: { [k: string]: string } = { "metadata[outcome]": r.status };
    if (r.booking) Object.assign(form, { "metadata[cal_uid]": r.booking.uid, "metadata[cal_start]": r.booking.start });
    await stripe(env.STRIPE_SECRET_KEY, `/payment_intents/${intent}`, form).catch(() => {});
  };
  await put({ status: "booking" });

  const b = fromMetadata(metadata);
  const link = dashboardLink(intent, env.STRIPE_SECRET_KEY);
  if (typeof b !== "string") {
    try {
      if (await isOpen(b)) {
        const booking = await bookCal(b, intent);
        await put({ status: "booked", booking: { uid: booking.uid, start: booking.start } });
        await tell(env, "booked", b, link);
        await sendConfirm(env.CLIENT_EMAIL, {
          ...b,
          session: SESSION[b.slug] ?? b.slug,
          start: booking.start,
          end: booking.end,
          uid: booking.uid,
          deposit: { ref: intent, at: new Date().toISOString(), card: await cardOf(env.STRIPE_SECRET_KEY, intent) },
        });
        return "booked";
      }
    } catch {
      // Falls through to the refund.
    }
  }

  try {
    await stripe(env.STRIPE_SECRET_KEY, "/refunds", { payment_intent: intent }, `refund-${intent}`);
    await put({ status: "refunded" });
    await tell(env, "refunded", b, link);
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
    await tell(env, "failed", b, link);
    return "failed";
  }
}
