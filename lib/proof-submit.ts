import { mail, stripe } from "@/lib/deposit";
import { recordLead } from "@/lib/leads";
import { alertLines, proofUrl, receiptMail, sendClient } from "@/lib/proof-mail";
import { owed, writeProof, type Proof } from "@/lib/proofs";

/* ── a client sends their selects ─────────────────────────────────
 * No extras: locked and mailed at once. Extras: a Stripe Checkout session
 * with one inline line item ("Extra retouched frame", $price × extras), so
 * nothing is created in Stripe's catalog. The selects lock only once
 * Checkout reports paid, checked on the return page (and again on any later
 * visit while a session is pending). The amount always comes from the
 * stored record, never the request.
 * ─────────────────────────────────────────────────────────────── */

type Env = Pick<CloudflareEnv, "INBOX" | "LEADS_KEY" | "VAPID_KEY" | "CLIENT_EMAIL" | "EMAIL"> & { STRIPE_SECRET_KEY?: string };
type KV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;
type Seal = { seal(v: unknown): Promise<string>; open<T>(s: string): Promise<T> };

/** Lock the selects and send both mails. */
export async function finalize(env: Env, kv: KV, s: Seal, p: Proof, paid?: Proof["paid"]): Promise<Proof> {
  const done: Proof = { ...p, submittedAt: new Date().toISOString(), checkout: undefined, ...(paid ? { paid } : {}) };
  await writeProof(kv, s, done);
  if (done.email) {
    const m = receiptMail(done);
    if (await sendClient(env.CLIENT_EMAIL, done.email, m)) await recordLead(env, done.email, { event: { at: done.submittedAt!, kind: "mail", note: m.subject, mail: { to: "client", kind: "proof-receipt" } } });
  }
  const a = alertLines(done);
  await mail(env.EMAIL, a.subject, [...a.lines, "", proofUrl(done.token)], done.email ? { name: done.email, email: done.email } : undefined);
  return done;
}

/** Checkout for the extras: the session's URL. */
export async function checkout(key: string, p: Proof): Promise<{ id: string; url: string }> {
  const x = owed(p);
  const back = proofUrl(p.token);
  const s = await stripe(
    key,
    "/checkout/sessions",
    {
      mode: "payment",
      "line_items[0][quantity]": String(x.n),
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": String(p.price * 100),
      "line_items[0][price_data][product_data][name]": "Extra retouched frame",
      success_url: `${back}?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: back,
      "metadata[proof]": p.token,
      "metadata[selects]": String(p.selects.length),
      ...(p.email ? { customer_email: p.email } : {}),
    },
    `proof-${p.token}-${p.selects.join(".")}`.slice(0, 255),
  );
  return { id: String(s.id), url: String(s.url) };
}

/** A Checkout session that is paid, for this gallery, for at least what the selects cost now. */
export async function paidFor(key: string, p: Proof, session: string): Promise<Proof["paid"] | null> {
  // A session already counted in `paid` never pays again (QA 2026-11-07: replayed after a reopen).
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(session) || session === p.paid?.session) return null;
  const s = await stripe(key, `/checkout/sessions/${session}`);
  const meta = s.metadata as Record<string, string> | undefined;
  if (s.payment_status !== "paid" || meta?.proof !== p.token || Number(s.amount_total) < owed(p).cents) return null;
  // Added to anything paid before the gallery was reopened.
  return { session, amount: (p.paid?.amount ?? 0) + Number(s.amount_total), at: new Date().toISOString() };
}
