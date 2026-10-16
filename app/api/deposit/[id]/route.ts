import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isIntentId, recordKey, type DepositRecord } from "@/lib/deposit";

/* ── how a deposit ended ───────────────────────────────────────────
 * The card polls this after paying: "pending" until Stripe's webhook has
 * run, then "booked", "refunded" or "failed". Status and booking time
 * only, never who booked. See `lib/deposit.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isIntentId(id)) return json({ error: "Unknown deposit." }, 404);
  const { env } = await getCloudflareContext({ async: true });
  const raw = await env.INBOX.get(recordKey(id));
  if (!raw) return json({ status: "pending" });
  const r = JSON.parse(raw) as DepositRecord;
  return json({ status: r.status === "booking" ? "pending" : r.status, ...(r.booking ? { booking: r.booking } : {}) });
}
