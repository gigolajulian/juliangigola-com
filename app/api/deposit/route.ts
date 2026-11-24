import { getCloudflareContext } from "@opennextjs/cloudflare";
import { liveHours, parseBooking } from "@/lib/booking/engine";
import { amountOf, intentForm } from "@/lib/booking/deposit";
import { CURRENCY } from "@/lib/leads/deposit-terms";
import { openNow } from "@/lib/booking/slots";
import { PAYMENTS_DOWN, stripe } from "@/lib/stripe";
import { bodyOf, json, limited, taken, upstreamError } from "@/lib/http";

/* ── a deposit starts ──────────────────────────────────────────────
 * The card posts the booking it wants; this checks the time is still
 * open in hello@'s calendar and creates the session's PaymentIntent for the Payment
 * Element. The amount is set here from the session, never taken from the request.
 * Off (503) until STRIPE_SECRET_KEY is set. See `lib/booking/deposit.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Deposits are off." }, 503);

  const slow = await limited(env.PUBLIC_WRITE_LIMIT, "deposit", request);
  if (slow) return slow;

  const parsed = parseBooking(await bodyOf(request));
  if (!parsed.ok) return json({ error: parsed.reason }, 400);
  const b = parsed.booking;

  try {
    if (!(await openNow(env.GCAL_OAUTH, b.slug, b.start, { kv: env.INBOX, hours: await liveHours(env) }))) return taken();
  } catch (e) {
    return upstreamError("deposit calendar", e, "Could not reach the calendar. Try again.");
  }

  try {
    const pi = await stripe(env.STRIPE_SECRET_KEY, "/payment_intents", intentForm(b));
    return json({ clientSecret: pi.client_secret, intentId: pi.id, amount: amountOf(b.slug), currency: CURRENCY });
  } catch (e) {
    return upstreamError("deposit intent", e, PAYMENTS_DOWN);
  }
}
