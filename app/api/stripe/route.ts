import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isDeposit, isIntentId, settle, verifyStripe } from "@/lib/booking/deposit";
import { recordLead } from "@/lib/leads/lead-store";
import { stripe } from "@/lib/stripe";

/* ── Stripe's webhook ──────────────────────────────────────────────
 * The source of truth for a deposit: the card saying it paid proves
 * nothing, Stripe's signed `payment_intent.succeeded` does. On it the
 * time is booked through the lock, or the deposit refunded (`settle`). Only
 * the site's own intents (`isDeposit`); anything else is left alone.
 *
 * Signed with STRIPE_WEBHOOK_SECRET; anything else is refused. Refuses
 * everything while either secret is unset. A 500 makes Stripe retry,
 * and a retry of a settled intent does nothing.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY || !env.INBOX) return text("Not set up.", 503);

  const body = await request.text();
  if (!(await verifyStripe(body, request.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET)))
    return text("Bad signature.", 401);

  let event: { type?: string; data?: { object?: { id?: string; amount?: number; amount_received?: number; currency?: string; receipt_email?: string | null; latest_charge?: string | null; description?: string | null; metadata?: { [k: string]: string } } } };
  try {
    event = JSON.parse(body);
  } catch {
    return text("Not JSON.", 400);
  }
  if (event.type === "charge.refunded") return refunded(env, event.data?.object as Charge | undefined);
  if (event.type !== "payment_intent.succeeded") return text("ok", 200);

  const pi = event.data?.object;
  if (!pi?.id || !isIntentId(pi.id)) return text("No intent.", 400);
  // Every other payment on the account (invoices, payment links) is never refunded here, only logged on the client's lead
  // and matched to an invoice. Proof checkouts log themselves (`lib/proof-submit.ts`), with the client's address.
  // The address: `receipt_email`, else the charge's billing details (Checkout and Payment Links keep it there).
  // A payer who is not a lead yet becomes one: they are a client now.
  if (!isDeposit(pi)) {
    const email = pi.metadata?.proof ? null : pi.receipt_email || (pi.latest_charge ? await stripe(env.STRIPE_SECRET_KEY, `/charges/${pi.latest_charge}`).then((c) => (c as { billing_details?: { email?: string | null } }).billing_details?.email ?? null, () => null) : null);
    if (email) {
      const said = `${pi.description ?? ""} ${pi.metadata?.invoice ?? ""}`;
      await recordLead(env, email, {
        event: { at: new Date().toISOString(), kind: "payment", ref: pi.id, note: pi.description ?? "Stripe", amount: (pi.amount_received ?? pi.amount ?? 0) / 100 },
        settles: true,
        invoiceNo: said.match(/\b\d{4}(?:-\d+)?\b/)?.[0],
      });
    }
    return text("ok", 200);
  }
  const status = await settle({ INBOX: env.INBOX, STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY, EMAIL: env.EMAIL, CLIENT_EMAIL: env.CLIENT_EMAIL, GCAL_OAUTH: env.GCAL_OAUTH, BOOKING_LOCK: env.BOOKING_LOCK, BOOKING_SECRET: env.BOOKING_SECRET }, pi.id, pi.metadata);
  // Still booking from an earlier delivery: Stripe retries until it ends or hello@ is warned.
  if (status === "booking") return text("Still booking.", 503);
  return text("ok", 200);
}

type Charge = { id?: string; payment_intent?: string | null; amount?: number; amount_refunded?: number; receipt_email?: string | null; billing_details?: { email?: string | null }; refunds?: { data?: { amount?: number }[] } };

/** A refund, from the site or by hand in the dashboard, on the client's activity log. A full refund shares the
 * site's own ref (`refund-<intent>`), so a cancel's refund is never logged twice; a partial one is keyed by the running total. */
async function refunded(env: CloudflareEnv, c: Charge | undefined) {
  const email = c?.receipt_email || c?.billing_details?.email;
  if (!c?.payment_intent || !email || !c.amount_refunded) return text("ok", 200);
  const full = c.amount_refunded >= (c.amount ?? Infinity);
  await recordLead(env, email, {
    event: { at: new Date().toISOString(), kind: "refund", ref: full ? `refund-${c.payment_intent}` : `refund-${c.payment_intent}-${c.amount_refunded}`, note: "Stripe", amount: (c.refunds?.data?.[0]?.amount ?? c.amount_refunded) / 100 },
  });
  return text("ok", 200);
}
