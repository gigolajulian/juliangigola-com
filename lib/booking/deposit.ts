import { afterBooked, cancelledSubject, sendCancelled } from "@/lib/booking/confirm";
import { enquiry, enquiryKey, summary, whenPT } from "@/lib/inbox";
import { logMail, recordLead } from "@/lib/leads/lead-store";
import { EVENTS, type Booking } from "@/lib/booking/rules";
import { lockOp, parseBooking, type BookingRecord } from "@/lib/booking/engine";
import { manageLinks } from "@/lib/booking/token";

/* ── the deposit ──────────────────────────────────────────────────
 * The paid sessions take a deposit on the
 * site, in the site's own card, before the time is booked. The order
 * is what keeps it honest: nothing is booked until Stripe says the money
 * arrived, so there are no unpaid holds.
 *
 *   1. POST /api/deposit checks the time is still open and creates a
 *      PaymentIntent. What to book rides on the intent's metadata, so an
 *      abandoned card costs no KV write.
 *   2. The visitor pays in the Stripe Payment Element.
 *   3. Stripe's signed webhook (`/api/stripe`) books the time through the
 *      lock (`lib/booking/engine.ts`). If the time went in the meantime,
 *      the deposit is refunded at once. If even the refund fails, the Inbox gets a row saying so.
 *   4. The card polls GET /api/deposit/<id> for the outcome. The webhook
 *      copies it onto the intent's metadata and the poll reads it from
 *      Stripe: KV caches a miss for up to a minute at the visitor's
 *      location, so the card read "pending" after the booking was made
 *      (QA, 2026-10-16).
 *   5. Julian hears about it: hello@ gets a mail for every
 *      deposit booked, refunded, or paid and stuck. The client's receipt
 *      is Stripe's, from `receipt_email`, and the site's own confirmation
 *      (`lib/booking/confirm.ts`) once the time is booked.
 *
 * Stripe is called over its REST API with fetch, no SDK: three calls do
 * not need a dependency. Test-mode keys until Julian says live.
 *
 * The deposit differs by session (`DEPOSIT` in
 * `lib/booking/paid.ts`). The charge is set here from the slug, never
 * from the request. What a booking paid is read off the intent and kept
 * on its record, so a refund, a mail or a log never guesses.
 * ─────────────────────────────────────────────────────────────── */

import { alertAndLog, type Attachment } from "@/lib/email/hello-mail";
import { stripe } from "@/lib/stripe";
import { DEPOSIT, LEGACY_DEPOSIT, PAID, isPaid } from "@/lib/booking/paid";
/** The charge in cents for a session. Throws on a slug that takes no deposit: `parseBooking` lets none through. */
export function amountOf(slug: string): number {
  if (!isPaid(slug)) throw new Error("Not a paid session.");
  return DEPOSIT[slug] * 100;
}
export const CURRENCY = "usd";
export const DEPOSIT_KIND = "deposit";

/** Whether a paid intent is one of the site's deposits, not any other payment on the account.
    Any session's amount passes, not only its own slug's: an intent made at the old $100 just
    before a price change must still book, or it sits paid and unbooked. */
export const isDeposit = (pi: { amount?: number; currency?: string; metadata?: { [k: string]: string } }) =>
  pi.metadata?.kind === DEPOSIT_KIND && [...Object.values(DEPOSIT), LEGACY_DEPOSIT].some((d) => d * 100 === pi.amount) && pi.currency === CURRENCY;
/** How old a webhook's timestamp may be before it is treated as a replay. */
const TOLERANCE_S = 300;
/** Each paid event's name, as its rule titles it. */
export const SESSION: { [slug: string]: string } = Object.fromEntries(PAID.map((s) => [s, EVENTS[s].title]));

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

/** The PaymentIntent's form, with the booking in its metadata. */
export function intentForm(b: Booking): { [k: string]: string } {
  const form: { [k: string]: string } = {
    amount: String(amountOf(b.slug)),
    currency: CURRENCY,
    // Card only, to match the card's deferred-intent Elements. Apple Pay and
    // Google Pay ride on card.
    "payment_method_types[]": "card",
    receipt_email: b.email,
    // Who and which session, readable in Stripe's payments list. Stripe prints it on the client's receipt too.
    // "Session" is the shoot's time, "Booked" the day they paid, both Pacific.
    description: `${SESSION[b.slug] ?? b.slug} deposit: ${b.name}. Session ${whenPT(b.start)}. Booked ${new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", year: "numeric" }).format(new Date())}.`,
  };
  for (const [k, v] of Object.entries(b)) if (v) form[`metadata[${k}]`] = v;
  // Marks the site's own intents: the webhook leaves every other payment
  // on the account (invoices, payment links) alone.
  form["metadata[kind]"] = DEPOSIT_KIND;
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
          const m = k.metadata;
          return buf && m ? { content: buf, filename: m.name, type: m.type, disposition: "attachment" as const } : null;
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
async function tell(env: Env, status: keyof typeof SAID, b: Booking | string, link: string, intent: string, usd: number, broke = "") {
  const who = typeof b === "string" ? undefined : b;
  const what = who ? [SESSION[who.slug] ?? who.slug, whenPT(who.start), who.name, `$${usd}`].join(", ") : `$${usd}`;
  const refs = await refsOf(env.INBOX, intent);
  // A refund after an error is not a taken time: say what broke.
  const next = broke && status === "refunded" ? `The booking failed on an error (${broke}), so Stripe refunded them. Nothing is booked.` : NEXT[status];
  const lines = [who ? `${who.name} <${who.email}>` : "Unknown client", next, `Stripe: ${link}`];
  if (refs.files.length) lines.push("", `References attached: ${refs.files.length}`);
  if (refs.picks.length) lines.push("", "Picked from my work:", ...refs.picks.map((src) => `https://juliangigola.com${src}`));
  const subject = `${SAID[status]}: ${what}`;
  await alertAndLog(env, subject, lines, who, { kind: `deposit-${status}`, booking: intent }, refs.files);
  // The money itself, on the activity log: what was paid in, and out again on a refund.
  if (who) await recordLead(env, who.email, { event: { at: new Date().toISOString(), kind: "payment", ref: intent, note: "Deposit", amount: usd } });
  if (who && status === "refunded") await recordLead(env, who.email, { event: { at: new Date().toISOString(), kind: "refund", ref: `refund-${intent}`, note: "Deposit, the time was gone", amount: usd } });
}

/**
 * A paid intent becomes a booking, once. Stripe may deliver the same event
 * twice; the record makes every delivery after the first a no-op.
 * ponytail: KV is not a lock, so two deliveries in the same second could both
 * book. Stripe spaces its retries by minutes; a Durable Object if that changes.
 */
export async function bookDeposit(env: Env, intent: string, metadata: { [k: string]: string } | undefined, cents?: number): Promise<Status> {
  const parsed = fromMetadata(metadata);
  // What the intent took, from Stripe; unset, the session's own deposit.
  const usd = cents !== undefined ? cents / 100 : parsed.ok && isPaid(parsed.booking.slug) ? DEPOSIT[parsed.booking.slug] : LEGACY_DEPOSIT;
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
      const who = parsed.ok ? parsed.booking : undefined;
      const what = who ? [SESSION[who.slug] ?? who.slug, whenPT(who.start), who.name, `$${usd}`].join(", ") : `$${usd}`;
      await env.INBOX.put(key, JSON.stringify({ ...r, warned: true }), { expirationTtl: 90 * 864e2 }).catch((e: unknown) => console.error("deposit record", "warned", String(e)));
      if (who) await recordLead(env, who.email, { event: { at: new Date().toISOString(), kind: "deposit-stuck", ref: intent, note: what }, name: who.name, kind: who.slug, flag: "stuck" });
      const subject = `Deposit stuck: check Stripe and the calendar: ${what}`;
      await alertAndLog(env, subject, [
        who ? `${who.name} <${who.email}>` : "Unknown client",
        `Paid, and the booking was started at ${r.at} but never finished. Check the calendar for the booking, then book or refund in Stripe by hand.`,
        `Stripe: ${dashboardLink(intent, env.STRIPE_SECRET_KEY)}`,
      ], who, { kind: "deposit-stuck", booking: intent });
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

  const link = dashboardLink(intent, env.STRIPE_SECRET_KEY);
  let broke = "";
  // What tell() and the stuck row read: the booking, or why the metadata is not one.
  const b = parsed.ok ? parsed.booking : parsed.reason;
  if (parsed.ok) {
    const want = parsed.booking;
    // The site's engine rechecks and books in one step, inside its lock.
    // Only the booking itself may end in a refund: a step after it never undoes a booked time.
    const own = await lockOp(env, "book", { ...want, intent, deposit: usd }).catch((e: unknown) => {
      broke = String(e);
      console.error("deposit book", broke);
      return null;
    });
    if (own?.ok) {
      const booking = own.record;
      await put({ status: "booked", booking: { uid: booking.id, start: booking.start } });
      await tell(env, "booked", want, link, intent, usd);
      // Not `confirmOf`: this mail maps the paid Booking and adds the card Stripe charged. The fee comes from the record, so it says 90% back.
      await afterBooked(env, booking, async () => ({
        ...want,
        session: SESSION[want.slug] ?? want.slug,
        start: booking.start,
        end: booking.end,
        uid: booking.id,
        deposit: { ref: intent, at: new Date().toISOString(), amount: usd, card: await cardOf(env.STRIPE_SECRET_KEY, intent), fee: booking.fee },
        manage: await manageLinks(env.BOOKING_SECRET, booking),
      }), { deposit: link, email: want.email });
      return "booked";
    }
  }

  try {
    await stripe(env.STRIPE_SECRET_KEY, "/refunds", { payment_intent: intent }, `refund-${intent}`);
    await put({ status: "refunded" });
    await tell(env, "refunded", b, link, intent, usd, broke);
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
          message: `A $${usd} deposit (${intent}) was paid, but the time could not be booked and the automatic refund failed. Refund it by hand in Stripe and email them.`,
        },
        now,
        id,
      ),
      type: "booking",
    };
    await env.INBOX.put(enquiryKey(now, id.slice(0, 8)), JSON.stringify(row), { metadata: summary(row) });
    await recordLead(env, who.email, { event: { at: row.at, kind: "deposit-stuck", ref: intent, note: row.detail }, name: who.name, kind: typeof b === "string" ? undefined : b.slug, flag: "stuck" });
    await tell(env, "failed", b, link, intent, usd);
    return "failed";
  }
}

/** After a cancel has taken a booking off the calendar: the refund through Stripe if `refund` is given and
    there is a deposit and a key, a cancel line on the lead, a refund line if it went, a mail to hello@, the
    client's note and its log. The client's cancel and the desk's each pass their own words and figures.
    `oneStamp`: the desk's two lead lines share one time; the client's each take their own. Whether it refunded. */
export async function cancelBooking(
  env: Parameters<typeof alertAndLog>[0] & { CLIENT_EMAIL?: CloudflareEnv["CLIENT_EMAIL"]; STRIPE_SECRET_KEY?: string },
  r: BookingRecord,
  was: BookingRecord,
  o: {
    refund?: { form: { [k: string]: string }; ref: string };
    note: string;
    refundNote: string;
    oneStamp?: boolean;
    subject: string;
    line: string;
    money: (refunded: boolean | undefined) => string;
    mail: (refunded: boolean | undefined) => Parameters<typeof sendCancelled>[2];
    usd: number | undefined;
    /** Dollars going back: the refund log line and the client's mail. */
    back: number;
  },
) {
  const who = { name: r.name, email: r.email };
  const key = env.STRIPE_SECRET_KEY;
  const refund = r.intent && key && o.refund ? { ...o.refund, key } : undefined;
  let refunded: boolean | undefined;
  if (refund) refunded = await stripe(refund.key, "/refunds", refund.form, refund.ref).then(() => true, () => false);
  const at = o.oneStamp ? new Date().toISOString() : undefined;
  await recordLead(env, r.email, { event: { at: at ?? new Date().toISOString(), kind: "cancel", ref: `cancel:${r.id}`, note: o.note } });
  // What went back, off this booking's record, so the log says what Stripe did.
  if (refunded && refund) await recordLead(env, r.email, { event: { at: at ?? new Date().toISOString(), kind: "refund", ref: refund.ref, note: o.refundNote, amount: o.back } });
  await alertAndLog(env, o.subject, [`${r.name} <${r.email}>`, o.line, o.money(refunded), ...(r.intent && key ? [`Stripe: ${dashboardLink(r.intent, key)}`] : [])], who, { kind: "cancelled", booking: r.id });
  const gone = { ...who, session: r.session, start: was.start, end: was.end };
  if (await sendCancelled(env.CLIENT_EMAIL, gone, o.mail(refunded), o.usd, o.back))
    await logMail(env, r.email, cancelledSubject(gone), { to: "client", kind: "cancelled", booking: r.id });
  return refunded;
}
