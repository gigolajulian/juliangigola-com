import { recordLead } from "@/lib/leads/lead-store";
import { stripe } from "@/lib/stripe";

export type PaymentIntent = {
  id: string;
  amount?: number;
  amount_received?: number;
  receipt_email?: string | null;
  latest_charge?: string | null;
  description?: string | null;
  metadata?: { [k: string]: string };
};

/** Every other payment on the account (invoices, payment links) is never refunded here, only logged on the client's lead
 * and matched to an invoice. Proof checkouts log themselves (`lib/proofs/submit.ts`), with the client's address.
 * The address: `receipt_email`, else the charge's billing details (Checkout and Payment Links keep it there).
 * A payer who is not a lead yet becomes one: they are a client now. */
export async function logPayment(env: CloudflareEnv, secretKey: string, pi: PaymentIntent): Promise<void> {
  const email = pi.metadata?.proof
    ? null
    : pi.receipt_email ||
      (pi.latest_charge
        ? await stripe(secretKey, `/charges/${pi.latest_charge}`).then(
            (c) => (c as { billing_details?: { email?: string | null } }).billing_details?.email ?? null,
            () => null,
          )
        : null);
  if (!email) return;
  const said = `${pi.description ?? ""} ${pi.metadata?.invoice ?? ""}`;
  await recordLead(env, email, {
    event: {
      at: new Date().toISOString(),
      kind: "payment",
      ref: pi.id,
      note: pi.description ?? "Stripe",
      amount: (pi.amount_received ?? pi.amount ?? 0) / 100,
    },
    settles: true,
    invoiceNo: said.match(/\b\d{4}(?:-\d+)?\b/)?.[0],
  });
}
