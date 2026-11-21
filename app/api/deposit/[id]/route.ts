import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isDeposit, isIntentId, refKey, type Status } from "@/lib/booking/deposit";
import { PAYMENTS_DOWN, stripe } from "@/lib/stripe";
import { MAX_REFS, takePicks, takeUploads } from "@/lib/inbox";
import { json } from "@/lib/http";

/* ── how a deposit ended ───────────────────────────────────────────
 * The card polls this after paying: "pending" until Stripe's webhook has
 * run, then "booked", "refunded" or "failed". Read from the intent's
 * metadata on Stripe, not KV, which lags a minute at other locations.
 * Status and booking time only, never who booked. See `lib/booking/deposit.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const DONE: readonly Status[] = ["booked", "refunded", "failed"];

type Intent = { amount?: number; currency?: string; metadata?: { [k: string]: string } };

/** A deposit's intent from Stripe. "missing": Stripe's 404 or not a deposit (a made-up id, not one still settling); "down": anything else. */
async function loadIntent(key: string, id: string): Promise<Intent | "missing" | "down"> {
  try {
    const pi: Intent = await stripe(key, `/payment_intents/${id}`);
    return isDeposit(pi) ? pi : "missing";
  } catch (e) {
    return (e as { status?: number }).status === 404 ? "missing" : "down";
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isIntentId(id)) return json({ error: "Unknown deposit." }, 404);
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_SECRET_KEY) return json({ status: "pending" });
  const pi = await loadIntent(env.STRIPE_SECRET_KEY, id);
  if (pi === "missing") return json({ error: "Unknown deposit." }, 404);
  if (pi === "down") return json({ status: "pending" });
  const m = pi.metadata ?? {};
  const status: Status = DONE.includes(m.outcome as Status) ? (m.outcome as Status) : "pending";
  return json({ status, ...(status === "booked" && m.cal_uid ? { booking: { uid: m.cal_uid, start: m.cal_start } } : {}) });
}

/* ── references with a deposit ─────────────────────────────────────
 * The booking card's References (`reference-picks.tsx`), sent by
 * `deposit-step.tsx` once the intent exists and before the card is
 * charged. Kept 30 days beside the intent; `tell` in `lib/booking/deposit.ts`
 * attaches them to the "Deposit paid" mail to hello@. Only for a live
 * deposit not yet settled, so an old id cannot reach the mail.
 * ─────────────────────────────────────────────────────────────── */

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!isIntentId(id)) return json({ error: "Unknown deposit." }, 404);
  const { env } = await getCloudflareContext({ async: true });
  if (!env.STRIPE_SECRET_KEY) return json({ error: "Deposits are off." }, 503);
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await env.DEPOSIT_LIMIT.limit({ key: ip })).success) return json({ error: "Too many tries. Wait a minute." }, 429);

  const pi = await loadIntent(env.STRIPE_SECRET_KEY, id);
  if (pi === "down") return json({ error: PAYMENTS_DOWN }, 502);
  if (pi === "missing" || pi.metadata?.outcome) return json({ error: "Unknown deposit." }, 404);

  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "Not a form." }, 400);
  const picks = takePicks(String(form.get("picks") ?? ""));
  const files = await takeUploads(form.getAll("refs"), MAX_REFS - picks.length);
  const ttl = { expirationTtl: 30 * 864e2 };
  await Promise.all([
    ...files.map(async (f, n) => env.INBOX.put(refKey(id, `f${n}`), await f.arrayBuffer(), { ...ttl, metadata: { name: f.name.slice(0, 80), type: f.type } })),
    ...(picks.length ? [env.INBOX.put(refKey(id, "picks"), picks.join("\n"), ttl)] : []),
  ]);
  return json({ files: files.length, picks: picks.length });
}
