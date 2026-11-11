import { getCloudflareContext } from "@opennextjs/cloudflare";
import { liveHours } from "@/lib/booking-engine";
import { AMOUNT, CURRENCY, intentForm, isOpen, parseBooking, stripe } from "@/lib/deposit";
import { json } from "@/lib/http";

/* ── a deposit starts ──────────────────────────────────────────────
 * The card posts the booking it wants; this checks the time is still
 * open in hello@'s calendar and creates a $100 PaymentIntent for the Payment
 * Element. The amount is fixed here, never taken from the request.
 * Off (503) until STRIPE_SECRET_KEY is set. See `lib/deposit.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Deposits are off." }, 503);

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await env.DEPOSIT_LIMIT.limit({ key: ip })).success)
    return json({ error: "Too many tries. Wait a minute." }, 429);

  const b = parseBooking(await request.json().catch(() => null));
  if (typeof b === "string") return json({ error: b }, 400);

  try {
    if (!(await isOpen(b, env.GCAL_OAUTH, env.INBOX, await liveHours(env)))) return json({ error: "taken" }, 409);
  } catch (e) {
    console.error("deposit calendar", String(e));
    return json({ error: "Could not reach the calendar. Try again." }, 502);
  }

  try {
    const pi = await stripe(env.STRIPE_SECRET_KEY, "/payment_intents", intentForm(b));
    return json({ clientSecret: pi.client_secret, intentId: pi.id, amount: AMOUNT, currency: CURRENCY });
  } catch (e) {
    console.error("deposit intent", String(e));
    return json({ error: "Payments are down. Try again in a minute." }, 502);
  }
}
