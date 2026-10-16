import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isDeposit, isIntentId, stripe } from "@/lib/deposit";

/* ── how a deposit ended ───────────────────────────────────────────
 * The card polls this after paying: "pending" until Stripe's webhook has
 * run, then "booked", "refunded" or "failed". Read from the intent's
 * metadata on Stripe, not KV, which lags a minute at other locations.
 * Status and booking time only, never who booked. See `lib/deposit.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

const DONE = ["booked", "refunded", "failed"];

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isIntentId(id)) return json({ error: "Unknown deposit." }, 404);
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_SECRET_KEY) return json({ status: "pending" });
  let pi: { amount?: number; currency?: string; metadata?: { [k: string]: string } };
  try {
    pi = await stripe(env.STRIPE_SECRET_KEY, `/payment_intents/${id}`);
  } catch {
    return json({ status: "pending" });
  }
  if (!isDeposit(pi)) return json({ error: "Unknown deposit." }, 404);
  const m = pi.metadata ?? {};
  const status = DONE.includes(m.outcome) ? m.outcome : "pending";
  return json({ status, ...(status === "booked" && m.cal_uid ? { booking: { uid: m.cal_uid, start: m.cal_start } } : {}) });
}
