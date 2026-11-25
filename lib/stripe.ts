import { HttpError } from "@/lib/http";
import { outbound } from "@/lib/net";

const STRIPE = "https://api.stripe.com/v1";

/** What a visitor reads when Stripe cannot answer. */
export const PAYMENTS_DOWN = "Payments are down right now. Try again in a few minutes.";
/** What a client reads when this build has no Stripe key. */
export const PAYMENTS_OFF = "Payments are off. Reply to my email and I'll sort it.";
/** What /admin reads when this build has no Stripe key. */
export const STRIPE_UNSET = "Stripe is not connected (STRIPE_SECRET_KEY).";

/** A call to Stripe's API: a form-encoded POST, or a GET without a form. */
export async function stripe(key: string, path: string, form?: { [k: string]: string }, idempotency?: string) {
  const res = await outbound(`${STRIPE}${path}`, {
    method: form ? "POST" : "GET",
    // A write repeats safely only with its idempotency key; Stripe then answers the first result again.
    retry: !form || !!idempotency,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // The account default rejects payment_method_types; pin a version that keeps card-only intents.
      "Stripe-Version": "2025-09-30.clover",
      ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
    },
    body: form ? new URLSearchParams(form) : undefined,
  });
  const out = (await res.json().catch(() => ({}))) as { [k: string]: unknown };
  if (!res.ok) {
    const err = out.error as { type?: string; code?: string; message?: string } | undefined;
    // Type and code only: Stripe's message can quote the customer's address.
    console.error("stripe", path.split("?")[0], res.status, err?.type, err?.code);
    throw new HttpError(`Stripe ${path} ${res.status}`, res.status);
  }
  return out;
}
