import { getCloudflareContext } from "@opennextjs/cloudflare";
import { liveHours, parseBooking } from "@/lib/booking/booking-engine";
import { AMOUNT, CURRENCY, intentForm, isSlotOpen } from "@/lib/booking/deposit";
import { PAYMENTS_DOWN, stripe } from "@/lib/stripe";
import { json } from "@/lib/http";

/* ── a deposit starts ──────────────────────────────────────────────
 * The card posts the booking it wants; this checks the time is still
 * open in hello@'s calendar and creates a $100 PaymentIntent for the Payment
 * Element. The amount is fixed here, never taken from the request.
 * Off (503) until STRIPE_SECRET_KEY is set. See `lib/booking/deposit.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Deposits are off." }, 503);

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await env.DEPOSIT_LIMIT.limit({ key: ip })).success)
    return json({ error: "Too many tries. Wait a minute." }, 429);

  const parsed = parseBooking(await request.json().catch(() => null));
  if (!parsed.ok) return json({ error: parsed.reason }, 400);
  const b = parsed.booking;

  try {
    if (!(await isSlotOpen(b, env.GCAL_OAUTH, env.INBOX, await liveHours(env)))) return json({ error: "taken" }, 409);
  } catch (e) {
    console.error("deposit calendar", String(e));
    return json({ error: "Could not reach the calendar. Try again." }, 502);
  }

  try {
    const pi = await stripe(env.STRIPE_SECRET_KEY, "/payment_intents", intentForm(b));
    return json({ clientSecret: pi.client_secret, intentId: pi.id, amount: AMOUNT, currency: CURRENCY });
  } catch (e) {
    console.error("deposit intent", String(e));
    return json({ error: PAYMENTS_DOWN }, 502);
  }
}
