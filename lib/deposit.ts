import { sendConfirm } from "@/lib/confirm";
import { enquiry, enquiryKey, looksLikeEmail, summary, whenPT } from "@/lib/inbox";
import { logMail, recordLead } from "@/lib/leads";
import { openNow, type KV } from "@/lib/slots";
import { EVENTS, type Booking, type Hours } from "@/lib/booking-rules";
import { lock, recordBooking } from "@/lib/booking-engine";
import { manageLinks } from "@/lib/booking-token";

/* ── the $100 deposit ─────────────────────────────────────────────
 * Julian (2026-10-16): the four paid sessions take a $100 deposit on the
 * site, in the site's own card, before the time is booked. The order
 * is what keeps it honest: nothing is booked until Stripe says the money
 * arrived, so there are no unpaid holds.
 *
 *   1. POST /api/deposit checks the time is still open and creates a
 *      PaymentIntent. What to book rides on the intent's metadata, so an
 *      abandoned card costs no KV write.
 *   2. The visitor pays in the Stripe Payment Element.
 *   3. Stripe's signed webhook (`/api/stripe`) books the time through the
 *      lock (`lib/booking-engine.ts`). If the time went in the meantime,
 *      the deposit is refunded at once. If even the refund fails, the Inbox gets a row saying so.
 *   4. The card polls GET /api/deposit/<id> for the outcome. The webhook
 *      copies it onto the intent's metadata and the poll reads it from
 *      Stripe: KV caches a miss for up to a minute at the visitor's
 *      location, so the card read "pending" after the booking was made
 *      (QA, 2026-10-16).
 *   5. Julian (2026-10-16) hears about it: hello@ gets a mail for every
 *      deposit booked, refunded, or paid and stuck. The client's receipt
 *      is Stripe's, from `receipt_email`, and the site's own confirmation
 *      (`lib/confirm.ts`) once the time is booked.
 *
 * Stripe is called over its REST API with fetch, no SDK: three calls do
 * not need a dependency. Test-mode keys until Julian says live.
 * ─────────────────────────────────────────────────────────────── */

import { isPaid } from "@/lib/paid";
import { mail, type Attachment } from "@/lib/hello-mail";
import { stripe } from "@/lib/stripe";
export const AMOUNT = 10000;
export const CURRENCY = "usd";
export const KIND = "deposit";

/** Whether a paid intent is one of the site's deposits, not any other payment on the account. */
export const isDeposit = (pi: { amount?: number; currency?: string; metadata?: { [k: string]: string } }) =>
  pi.metadata?.kind === KIND && pi.amount === AMOUNT && pi.currency === CURRENCY;
/** How old a webhook's timestamp may be before it is treated as a replay. */
const TOLERANCE_S = 300;
export const SESSION: { [slug: string]: string } = { portraits: "Portraits", headshots: "Headshots", graduation: "Graduation photos", digitals: "Studio digitals" };

/** The intent in Stripe's dashboard, test or live as the key is. */
export const dashboardLink = (intent: string, key: string) =>
  `https://dashboard.stripe.com/${/_live_/.test(key) ? "" : "test/"}payments/${intent}`;

/** What GET /api/deposit/<id> reports. "booking" is internal: a webhook is on it. */
export type Status = "pending" | "booking" | "booked" | "refunded" | "failed";
export type DepositRecord = { status: Status; at: string; booking?: { uid: string; start: string }; warned?: true };

/** How long "booking" may stand before Stripe's retry takes it as stuck. */
const STUCK_MS = 2 * 60 * 1000;

export const recordKey = (intent: string) => `deposit:${intent}`;
/** A reference sent with the deposit (`app/api/deposit/[id]`): `f<n>` a file, `picks` frames of mine. */
export const refKey = (intent: string, part: string) => `dref:${intent}:${part}`;
export const isIntentId = (s: string) => /^pi_[A-Za-z0-9]{8,64}$/.test(s);

// Stripe caps a metadata value at 500 characters.
const cap = (s: unknown, n = 500) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** The visitor's booking, checked, or the reason it is not one. `call`: a free call (`app/api/book`), not a paid session. */
export function parseBooking(raw: unknown, call = false): Booking | string {
  const b = (raw ?? {}) as { [k: string]: unknown };
  const slug = cap(b.slug);
  if (call ? !EVENTS[slug]?.call : !isPaid(slug)) return call ? "Not a call." : "Not a paid session.";
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
    engine: "own",
  };
}

/**
 * Whether the start is still offered by hello@'s calendar.
 * `hours`: Julian's, from the lock (`liveHours`); the defaults when unset.
 */
export async function isSlotOpen(b: Booking, gcalSecret?: string, kv?: KV, hours?: Hours): Promise<boolean> {
  return openNow(gcalSecret, b.slug, b.start, { kv, hours });
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
  // on the account (invoices, payment links) alone.
  form["metadata[kind]"] = KIND;
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

type Env = {
  INBOX: NonNullable<CloudflareEnv["INBOX"]>;
  LEADS_KEY?: string;
  STRIPE_SECRET_KEY: string;
  EMAIL?: CloudflareEnv["EMAIL"];
  CLIENT_EMAIL?: CloudflareEnv["CLIENT_EMAIL"];
  GCAL_OAUTH?: string;
  BOOKING_LOCK?: CloudflareEnv["BOOKING_LOCK"];
  NOTION_TOKEN?: string;
  BOOKING_SECRET?: string;
};

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
  booked: "Booked.",
  refunded: "The time was gone, so Stripe refunded them. Nothing is booked.",
  failed: "The time could not be booked and the automatic refund failed. Refund it by hand in Stripe and email them.",
};

/** The references sent with a deposit (`app/api/deposit/[id]`): files to attach, and the frames of mine they picked. Nothing if KV fails. */
async function refsOf(inbox: Env["INBOX"], intent: string): Promise<{ files: Attachment[]; picks: string[] }> {
  try {
    type Key = { name: string; metadata?: { name: string; type: string } };
    const { keys } = (await inbox.list({ prefix: refKey(intent, "") })) as { keys: Key[] };
    const files: (Attachment | null)[] = await Promise.all(
      keys
        .filter((k: Key) => k.metadata?.type)
        .map(async (k: Key) => {
          const buf = (await inbox.get(k.name, "arrayBuffer")) as ArrayBuffer | null;
          return buf ? { content: buf, filename: k.metadata!.name, type: k.metadata!.type, disposition: "attachment" as const } : null;
        }),
    );
    const picks = (((await inbox.get(refKey(intent, "picks"))) as string | null) ?? "").split("\n").filter(Boolean);
    return { files: files.filter((f): f is Attachment => f !== null), picks };
  } catch (e) {
    console.error("deposit refs", String(e));
    return { files: [], picks: [] };
  }
}

/** A plain mail to hello@ saying how a deposit ended. A failed send is logged, never a failed webhook. */
async function tell(env: Env, status: keyof typeof SAID, b: Booking | string, link: string, intent: string, broke = "") {
  const who = typeof b === "string" ? undefined : b;
  const what = who ? [SESSION[who.slug] ?? who.slug, whenPT(who.start), who.name, "$100"].join(", ") : "$100";
  const refs = await refsOf(env.INBOX, intent);
  // A refund after an error is not a taken time: say what broke.
  const next = broke && status === "refunded" ? `The booking failed on an error (${broke}), so Stripe refunded them. Nothing is booked.` : NEXT[status];
  const lines = [who ? `${who.name} <${who.email}>` : "Unknown client", next, `Stripe: ${link}`];
  if (refs.files.length) lines.push("", `References attached: ${refs.files.length}`);
  if (refs.picks.length) lines.push("", "Picked from my work:", ...refs.picks.map((src) => `https://juliangigola.com${src}`));
  const subject = `${SAID[status]}: ${what}`;
  if (await mail(env.EMAIL, subject, lines, who, refs.files)) await logMail(env, who?.email, subject, { to: "hello@", kind: `deposit-${status}`, booking: intent });
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
  if (seen) {
    const r = JSON.parse(seen) as DepositRecord;
    /* "booking" is written before the lock is asked. If the Worker was cut
       off there, every retry from Stripe returned here in silence and the
       deposit sat paid, maybe booked, maybe not. Past two minutes, hello@
       hears once; the record keeps its status and is marked warned. */
    // Under two minutes and not yet warned: "booking", so the webhook asks
    // Stripe to come back (503). Once hello@ has heard, Stripe may stop.
    if (r.status === "booking" && r.warned) return "failed";
    if (r.status === "booking" && Date.now() - Date.parse(r.at) > STUCK_MS) {
      const b = fromMetadata(metadata);
      const who = typeof b === "string" ? undefined : b;
      const what = who ? [SESSION[who.slug] ?? who.slug, whenPT(who.start), who.name, "$100"].join(", ") : "$100";
      await env.INBOX.put(key, JSON.stringify({ ...r, warned: true }), { expirationTtl: 90 * 864e2 }).catch((e: unknown) => console.error("deposit record", "warned", String(e)));
      if (who) await recordLead(env, who.email, { event: { at: new Date().toISOString(), kind: "deposit-stuck", ref: intent, note: what }, name: who.name, kind: who.slug, flag: "stuck" });
      const subject = `Deposit stuck: check Stripe and the calendar: ${what}`;
      if (await mail(env.EMAIL, subject, [
        who ? `${who.name} <${who.email}>` : "Unknown client",
        `Paid, and the booking was started at ${r.at} but never finished. Check the calendar for the booking, then book or refund in Stripe by hand.`,
        `Stripe: ${dashboardLink(intent, env.STRIPE_SECRET_KEY)}`,
      ], who)) await logMail(env, who?.email, subject, { to: "hello@", kind: "deposit-stuck", booking: intent });
      return "failed";
    }
    return r.status;
  }

  const put = async (r: Omit<DepositRecord, "at">) => {
    const write = env.INBOX.put(key, JSON.stringify({ ...r, at: new Date().toISOString() }), { expirationTtl: 90 * 864e2 });
    // "booking" must land, or a retry books twice. The outcome is only a
    // record, and KV refuses a second write to a key within a second: a
    // failed one must never turn a booking into a refund.
    if (r.status === "booking") return write;
    await write.catch((e: unknown) => console.error("deposit record", r.status, String(e)));
    // The card's copy (see 4. above). A failed copy only leaves the card on
    // "Still confirming"; it must never turn a booking into a refund.
    const form: { [k: string]: string } = { "metadata[outcome]": r.status };
    if (r.booking) Object.assign(form, { "metadata[cal_uid]": r.booking.uid, "metadata[cal_start]": r.booking.start });
    await stripe(env.STRIPE_SECRET_KEY, `/payment_intents/${intent}`, form).catch(() => {});
  };
  await put({ status: "booking" });

  const b = fromMetadata(metadata);
  const link = dashboardLink(intent, env.STRIPE_SECRET_KEY);
  let broke = "";
  if (typeof b !== "string") {
    // The site's engine rechecks and books in one step, inside its lock.
    // Only the booking itself may end in a refund: a step after it never undoes a booked time.
    const own = await lock(env, "book", { ...b, intent }).catch((e: unknown) => {
      broke = String(e);
      console.error("deposit book", broke);
      return null;
    });
    if (own?.ok) {
      const booking = own.record;
      await put({ status: "booked", booking: { uid: booking.id, start: booking.start } });
      await tell(env, "booked", b, link, intent);
      await recordBooking(env, booking, dashboardLink(intent, env.STRIPE_SECRET_KEY));
      const confirm = {
        ...b,
        session: SESSION[b.slug] ?? b.slug,
        start: booking.start,
        end: booking.end,
        uid: booking.id,
        deposit: { ref: intent, at: new Date().toISOString(), card: await cardOf(env.STRIPE_SECRET_KEY, intent) },
        manage: await manageLinks(env.BOOKING_SECRET, booking),
      };
      const sent = await sendConfirm(env.CLIENT_EMAIL, confirm);
      if (sent) await logMail(env, b.email, sent, { to: "client", kind: "confirm", booking: booking.id });
      return "booked";
    }
  }

  try {
    await stripe(env.STRIPE_SECRET_KEY, "/refunds", { payment_intent: intent }, `refund-${intent}`);
    await put({ status: "refunded" });
    await tell(env, "refunded", b, link, intent, broke);
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
          message: `A $100 deposit (${intent}) was paid, but the time could not be booked and the automatic refund failed. Refund it by hand in Stripe and email them.`,
        },
        now,
        id,
      ),
      type: "booking",
    };
    await env.INBOX.put(enquiryKey(now, id.slice(0, 8)), JSON.stringify(row), { metadata: summary(row) });
    await recordLead(env, who.email, { event: { at: row.at, kind: "deposit-stuck", ref: intent, note: row.detail }, name: who.name, kind: typeof b === "string" ? undefined : b.slug, flag: "stuck" });
    await tell(env, "failed", b, link, intent);
    return "failed";
  }
}
