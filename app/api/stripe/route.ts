import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isDeposit, isIntentId, settle, verifyStripe } from "@/lib/booking/deposit";
import { recordLead } from "@/lib/leads/lead-store";

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

  let event: { type?: string; data?: { object?: { id?: string; amount?: number; amount_received?: number; currency?: string; receipt_email?: string | null; description?: string | null; metadata?: { [k: string]: string } } } };
  try {
    event = JSON.parse(body);
  } catch {
    return text("Not JSON.", 400);
  }
  if (event.type !== "payment_intent.succeeded") return text("ok", 200);

  const pi = event.data?.object;
  if (!pi?.id || !isIntentId(pi.id)) return text("No intent.", 400);
  // Every other payment on the account (invoices, payment links) is never refunded here, only logged on the client's lead
  // and matched to an invoice. Proof checkouts log themselves (`lib/proof-submit.ts`), with the client's address.
  // shortcut: the address is `receipt_email`; a payment without one is not logged (a charge lookup would find more).
  if (!isDeposit(pi)) {
    if (!pi.metadata?.proof && pi.receipt_email) {
      const said = `${pi.description ?? ""} ${pi.metadata?.invoice ?? ""}`;
      await recordLead(env, pi.receipt_email, {
        event: { at: new Date().toISOString(), kind: "payment", ref: pi.id, note: pi.description ?? "Stripe", amount: (pi.amount_received ?? pi.amount ?? 0) / 100 },
        settles: true,
        invoiceNo: said.match(/\b\d{4}(?:-\d+)?\b/)?.[0],
      });
    }
    return text("ok", 200);
  }
  const status = await settle({ INBOX: env.INBOX, STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY, EMAIL: env.EMAIL, CLIENT_EMAIL: env.CLIENT_EMAIL, GCAL_OAUTH: env.GCAL_OAUTH, BOOKING_LOCK: env.BOOKING_LOCK, NOTION_TOKEN: env.NOTION_TOKEN, BOOKING_SECRET: env.BOOKING_SECRET }, pi.id, pi.metadata);
  // Still booking from an earlier delivery: Stripe retries until it ends or hello@ is warned.
  if (status === "booking") return text("Still booking.", 503);
  return text("ok", 200);
}
