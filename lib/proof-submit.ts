import { alertHello } from "@/lib/hello-mail";
import { stripe } from "@/lib/stripe";
import { recordLead } from "@/lib/leads/lead-store";
import { alertLines, proofUrl, receiptMail, sendClient } from "@/lib/email/proof-mail";
import { cardPrice, owed, publicId, viewerKey, writeProof, type Proof } from "@/lib/proofs";
import type { InboxKV as KV } from "@/lib/leads/lead-store";

/* ── a client sends their selects ─────────────────────────────────
 * Nothing to pay: locked and mailed at once. A shoot balance or extras: a Stripe Checkout session
 * with inline line items ("Shoot balance", "Extra retouched frame" × extras), so
 * nothing is created in Stripe's catalog. The selects lock only once
 * Checkout reports paid, checked on the return page (and again on any later
 * visit while a session is pending). The amount always comes from the
 * stored record, never the request.
 * ─────────────────────────────────────────────────────────────── */

type Env = Pick<CloudflareEnv, "INBOX" | "LEADS_KEY" | "VAPID_KEY" | "CLIENT_EMAIL" | "EMAIL"> & { STRIPE_SECRET_KEY?: string };
type Seal = { seal(v: unknown): Promise<string>; open<T>(s: string): Promise<T> };

/** Lock the selects and send both mails. */
export async function finalize(env: Env, kv: KV, s: Seal, p: Proof, paid?: Proof["paid"]): Promise<Proof> {
  const at = new Date().toISOString();
  let done: Proof = { ...p, submittedAt: at, checkout: undefined, ...(paid ? { paid } : {}) };
  // The copy goes to whoever sent them, which may not be the address the gallery went to.
  const to = done.submittedBy ?? done.email;
  const k = done.submittedBy && viewerKey(done.submittedBy);
  if (k && done.viewers?.[k]) {
    const v = done.viewers[k];
    const events = [...v.events, ...(paid ? [{ at, kind: "pay" as const }] : []), { at, kind: "send" as const }];
    done = { ...done, viewers: { ...done.viewers, [k]: { ...v, last: at, events } } };
  }
  await writeProof(kv, s, done);
  if (to) {
    await recordLead(env, to, { event: { at, kind: "selects", ref: `selects:${done.token}:${at}`, note: `${done.selects.length} frames, ${done.name}` } });
    // A shoot balance paid here settles its invoice; Stripe's webhook skips these (`metadata[proof]`).
    if (paid && !paid.pending && !paid.failed) await recordLead(env, to, { event: { at, kind: "payment", ref: paid.session, note: `Proofs, ${done.name}`, amount: paid.amount / 100 }, settles: true });
  }
  if (to) {
    const m = receiptMail(done);
    if (await sendClient(env.CLIENT_EMAIL, to, m)) await recordLead(env, to, { event: { at, kind: "mail", note: m.subject, mail: { to: "client", kind: "proof-receipt" } } });
  }
  const a = alertLines(done);
  await alertHello(env.EMAIL, a.subject, [...a.lines, "", proofUrl(publicId(done))], to ? { name: to, email: to } : undefined);
  return done;
}

const lines = (items: { name: string; qty: number; cents: number }[]) =>
  Object.fromEntries(
    items.flatMap((l, i) => [
      [`line_items[${i}][quantity]`, String(l.qty)],
      [`line_items[${i}][price_data][currency]`, "usd"],
      [`line_items[${i}][price_data][unit_amount]`, String(l.cents)],
      [`line_items[${i}][price_data][product_data][name]`, l.name],
    ]),
  );

/** Checkout for the balance and the extras: the session's URL. Bank first (Julian 2026-11-09: ACH is 0.8% capped at $5, card 2.9% + 30c); card when the client picks it. */
export async function checkout(key: string, p: Proof, method: "bank" | "card" = "bank"): Promise<{ id: string; url: string }> {
  const card = method === "card";
  const x = owed(p);
  const back = proofUrl(publicId(p));
  const list = cardPrice(x.cents);
  const what = [x.balance ? "Shoot balance" : "", x.n ? `${x.n} extra retouched ${x.n === 1 ? "frame" : "frames"}` : ""].filter(Boolean).join(" + ");
  // v2: the request gained payment_intent_data metadata (2026-11-11); Stripe refuses an old key with new parameters.
  const tag = `proof2-${p.token}-${x.cents}-${p.selects.join(".")}`;
  // One list price on both receipts; bank gets it back as a discount.
  const off = card
    ? null
    : await stripe(key, "/coupons", { amount_off: String(list - x.cents), currency: "usd", duration: "once", max_redemptions: "1", name: "Paid by bank" }, `${tag}-coupon`.slice(-255)).catch(() => null);
  if (!card && !off) return checkout(key, p, "card");
  const s = await stripe(
    key,
    "/checkout/sessions",
    {
      mode: "payment",
      "payment_method_types[0]": card ? "card" : "us_bank_account",
      ...lines([{ name: `${p.name}: ${what}`, qty: 1, cents: list }]),
      ...(off ? { "discounts[0][coupon]": String(off.id) } : {}),
      success_url: `${back}?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: back,
      "metadata[proof]": p.token,
      // On the payment too, so the webhook knows it is a proof payment.
      "payment_intent_data[metadata][proof]": p.token,
      "metadata[selects]": String(p.selects.length),
      ...((p.submittedBy ?? p.email) ? { customer_email: p.submittedBy ?? p.email } : {}),
    },
    `${tag}-${method}`.slice(-255),
  ).catch((e: unknown) => {
    // Pay by bank needs ACH Direct Debit switched on in the Stripe dashboard; card until it is.
    if (card) throw e;
    return null;
  });
  if (!s) return checkout(key, p, "card");
  // A reply without both would send the visitor to /undefined; the route answers it as an outage.
  if (typeof s.id !== "string" || typeof s.url !== "string") throw new Error("Stripe checkout session without id or url");
  return { id: s.id, url: s.url };
}

/** A Checkout session that is paid, for this gallery, for at least what the selects cost now. */
export async function paidFor(key: string, p: Proof, session: string): Promise<Proof["paid"] | null> {
  // A session already counted in `paid` never pays again (QA 2026-11-07: replayed after a reopen).
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(session) || session === p.paid?.session) return null;
  const s = await stripe(key, `/checkout/sessions/${session}`);
  const meta = s.metadata as Record<string, string> | undefined;
  // A bank payment comes back complete but unpaid: accepted, settling in about 4 business days. The selects lock now; settle() follows it.
  const bank = s.status === "complete" && s.payment_status === "unpaid";
  // No amount is no payment: NaN would pass the `<` check and be stored as paid.
  const total = s.amount_total;
  if ((s.payment_status !== "paid" && !bank) || meta?.proof !== p.token || typeof total !== "number" || total < owed(p).cents) return null;
  // Added to anything paid before the gallery was reopened.
  // A card payment carries Stripe's fee on top: only what was owed counts toward the balance and extras.
  return { session, amount: (p.paid?.amount ?? 0) + Math.min(total, owed(p).cents), at: new Date().toISOString(), ...(bank ? { pending: true } : {}) };
}

/** paidFor, with Stripe's silence told apart: a refused session (4xx) is null, no answer or a 5xx is "down". */
export const checkPaid = (key: string, p: Proof, session: string) =>
  paidFor(key, p, session).catch((e: { status?: number }) => (e.status && e.status < 500 ? null : ("down" as const)));

/** A settling bank payment, checked again: cleared, bounced, or still on its way. Null when nothing changed. */
export async function settle(key: string, p: Proof): Promise<Proof | null> {
  if (!p.paid?.pending) return null;
  const s = await stripe(key, `/checkout/sessions/${p.paid.session}?expand[]=payment_intent`);
  if (s.payment_status === "paid") return { ...p, paid: { ...p.paid, pending: undefined } };
  const pi = s.payment_intent as { status?: string } | null;
  // Without an amount to take back, leave it settling: the next check tries again.
  if (typeof s.amount_total !== "number") return null;
  if (pi?.status === "requires_payment_method" || pi?.status === "canceled") return { ...p, paid: { ...p.paid, pending: undefined, failed: true, amount: Math.max(0, p.paid.amount - s.amount_total) } };
  return null;
}
