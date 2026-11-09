import { mail, stripe } from "@/lib/deposit";
import { recordLead } from "@/lib/leads";
import { alertLines, proofUrl, receiptMail, sendClient } from "@/lib/proof-mail";
import { owed, viewerKey, writeProof, type Proof } from "@/lib/proofs";

/* ── a client sends their selects ─────────────────────────────────
 * Nothing to pay: locked and mailed at once. A shoot balance or extras: a Stripe Checkout session
 * with inline line items ("Shoot balance", "Extra retouched frame" × extras), so
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
    const m = receiptMail(done);
    if (await sendClient(env.CLIENT_EMAIL, to, m)) await recordLead(env, to, { event: { at, kind: "mail", note: m.subject, mail: { to: "client", kind: "proof-receipt" } } });
  }
  const a = alertLines(done);
  await mail(env.EMAIL, a.subject, [...a.lines, "", proofUrl(done.token)], to ? { name: to, email: to } : undefined);
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

/** Checkout for the balance and the extras: the session's URL. */
export async function checkout(key: string, p: Proof): Promise<{ id: string; url: string }> {
  const x = owed(p);
  const back = proofUrl(p.token);
  const s = await stripe(
    key,
    "/checkout/sessions",
    {
      mode: "payment",
      ...lines([
        ...(x.balance ? [{ name: "Shoot balance", qty: 1, cents: x.balance }] : []),
        ...(x.n ? [{ name: "Extra retouched frame", qty: x.n, cents: p.price * 100 }] : []),
      ]),
      success_url: `${back}?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: back,
      "metadata[proof]": p.token,
      "metadata[selects]": String(p.selects.length),
      ...((p.submittedBy ?? p.email) ? { customer_email: p.submittedBy ?? p.email } : {}),
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
