import { getCloudflareContext } from "@opennextjs/cloudflare";
import { AMOUNT, CURRENCY, intentForm, isOpen, parseBooking, stripe } from "@/lib/deposit";

/* ── a deposit starts ──────────────────────────────────────────────
 * The card posts the booking it wants; this checks the time is still
 * open on Cal.com and creates a $100 PaymentIntent for the Payment
 * Element. The amount is fixed here, never taken from the request.
 * Off (503) until STRIPE_SECRET_KEY is set. See `lib/deposit.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Deposits are off." }, 503);

  const b = parseBooking(await request.json().catch(() => null));
  if (typeof b === "string") return json({ error: b }, 400);

  try {
    if (!(await isOpen(b))) return json({ error: "taken" }, 409);
  } catch {
    return json({ error: "Could not reach the calendar. Try again." }, 502);
  }

  try {
    const pi = await stripe(env.STRIPE_SECRET_KEY, "/payment_intents", intentForm(b));
    return json({ clientSecret: pi.client_secret, intentId: pi.id, amount: AMOUNT, currency: CURRENCY });
  } catch {
    return json({ error: "Payments are down. Try again in a minute." }, 502);
  }
}
