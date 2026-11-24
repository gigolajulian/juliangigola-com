import { importStripe } from "@/lib/leads/sync/stripe-import";
import { STRIPE_UNSET } from "@/lib/stripe";
import { gate } from "@/lib/admin/gate";
import { bodyOf, json, upstreamError } from "@/lib/http";
import { errorText } from "@/lib/utils";

/* POST `{ dry? }`: past Stripe payments and refunds onto the log (`lib/leads/sync/stripe-import.ts`). Dry, it only
   counts; only an explicit `dry: false` writes. Behind the /admin gate. */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const dry = (await bodyOf(request))?.dry !== false;
  if (!g.env.STRIPE_SECRET_KEY) return json({ error: STRIPE_UNSET }, 503);
  try {
    return json(await importStripe(g.env, g.env.STRIPE_SECRET_KEY, dry));
  } catch (e) {
    return upstreamError("stripe import", e, errorText(e));
  }
}
