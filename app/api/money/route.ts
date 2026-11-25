import { getCloudflareContext } from "@opennextjs/cloudflare";
import { STRIPE_UNSET, stripe } from "@/lib/stripe";
import { refuseAdmin } from "@/lib/admin/vouch";
import { json, upstreamError } from "@/lib/http";
import type { MoneyAnswer } from "@/lib/leads/money";

/* ── GET /api/money: his Stripe balance and what moved it ─────────
 * The Stripe balance and its transactions.
 * Read-only: the balance (available and on the
 * way) and the latest balance transactions, 25 a page, with who paid when
 * Stripe knows. Behind the /admin gate. Nothing here can move money.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

type Amount = { amount: number; currency: string };
type Txn = {
  id: string;
  created: number;
  type: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  status: string;
  description?: string | null;
  source?: { billing_details?: { name?: string | null }; metadata?: Record<string, string>; description?: string | null } | string | null;
};

/** Who or what a line was, in a few words. */
const what = (t: Txn) => {
  const s = typeof t.source === "object" && t.source ? t.source : undefined;
  return s?.billing_details?.name || s?.metadata?.name || t.description || s?.description || "";
};
const usd = (list: Amount[] = []) => list.filter((a) => a.currency === "usd").reduce((n, a) => n + a.amount, 0);

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await refuseAdmin(request, env.INBOX_KEY);
  if (denied) return denied;
  const key = env.STRIPE_SECRET_KEY;
  if (!key) return json({ error: STRIPE_UNSET }, 503);

  const after = new URL(request.url).searchParams.get("after");
  if (after && !/^txn_[A-Za-z0-9]{8,64}$/.test(after)) return json({ error: "Bad cursor." }, 400);
  try {
    const [balance, list] = await Promise.all([
      after ? null : stripe(key, "/balance"),
      stripe(key, `/balance_transactions?limit=25&expand[]=data.source${after ? `&starting_after=${after}` : ""}`),
    ]);
    const data = (list.data ?? []) as Txn[];
    const body: MoneyAnswer = {
      ...(balance
        ? { available: usd(balance.available as Amount[]), pending: usd(balance.pending as Amount[]), test: key.startsWith("sk_test_") }
        : {}),
      more: !!list.has_more,
      txns: data.map((t) => ({
        id: t.id,
        at: new Date(t.created * 1000).toISOString(),
        type: t.type,
        amount: t.amount,
        fee: t.fee,
        net: t.net,
        currency: t.currency,
        status: t.status,
        what: what(t),
      })),
    };
    return json(body);
  } catch (e) {
    // Stripe's own detail is logged by `stripe()`; the key never leaves the Worker.
    return upstreamError("money", e, "Stripe did not answer. Try again in a minute.");
  }
}
