import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isDeposit, isIntentId, settle, verifyStripe } from "@/lib/deposit";

/* ── Stripe's webhook ──────────────────────────────────────────────
 * The source of truth for a deposit: the card saying it paid proves
 * nothing, Stripe's signed `payment_intent.succeeded` does. On it the
 * time is booked on Cal.com, or the deposit refunded (`settle`). Only
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

  let event: { type?: string; data?: { object?: { id?: string; amount?: number; currency?: string; metadata?: { [k: string]: string } } } };
  try {
    event = JSON.parse(body);
  } catch {
    return text("Not JSON.", 400);
  }
  if (event.type !== "payment_intent.succeeded") return text("ok", 200);

  const pi = event.data?.object;
  if (!pi?.id || !isIntentId(pi.id)) return text("No intent.", 400);
  // Every other payment on the account (Cal.com's own, invoices, payment
  // links) is none of this route's business: acknowledged, never refunded.
  if (!isDeposit(pi)) return text("ok", 200);
  await settle({ INBOX: env.INBOX, STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY, EMAIL: env.EMAIL, CLIENT_EMAIL: env.CLIENT_EMAIL }, pi.id, pi.metadata);
  return text("ok", 200);
}
