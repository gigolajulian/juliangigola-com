/* ── past Stripe payments onto the activity log ────────────────────
 * Julian (2026-11-11): OK to import past Stripe deposits. Pages every
 * succeeded PaymentIntent and refund on the account and records each on the
 * payer's lead with the refs the live paths use, so nothing counts twice:
 *   payment   ref = the intent id (deposits in `lib/booking/deposit.ts`, others in `app/api/stripe/route.ts`)
 *   refund    ref = `refund-<intent>` when the charge is fully refunded, else `refund-<intent>-<cents refunded so far>`
 * Proof checkouts are skipped: `lib/proof-submit.ts` logs them under the Checkout session id.
 * An event already on the lead or anywhere in its log is left alone. Server only.
 * ─────────────────────────────────────────────────────────────── */

import { stripe } from "@/lib/stripe";
import { isDeposit } from "@/lib/booking/deposit";
import { readLead, recordLead, type LeadStore } from "./lead-store";
import { readLog } from "./activity-log";
import { sealer } from "./lead-crypto";
import type { Change } from "./leads";

type Intent = {
  id: string;
  status?: string;
  created: number;
  amount?: number;
  amount_received?: number;
  currency?: string;
  description?: string | null;
  receipt_email?: string | null;
  metadata?: { [k: string]: string };
  latest_charge?: { billing_details?: { email?: string | null; name?: string | null } } | string | null;
};
type Refund = { id: string; status?: string; created: number; amount: number; payment_intent?: string | null };

/** Every object of one Stripe list, oldest last, 100 a page. */
async function all<T extends { id: string }>(key: string, path: string): Promise<T[]> {
  const out: T[] = [];
  let after = "";
  for (;;) {
    const page = (await stripe(key, `${path}${path.includes("?") ? "&" : "?"}limit=100${after ? `&starting_after=${after}` : ""}`)) as { data?: T[]; has_more?: boolean };
    out.push(...(page.data ?? []));
    if (!page.has_more || !page.data?.length) return out;
    after = page.data[page.data.length - 1].id;
  }
}

const iso = (s: number) => new Date(s * 1000).toISOString();
const charge = (pi: Intent) => (typeof pi.latest_charge === "object" ? pi.latest_charge?.billing_details : undefined);
/** The payer, as the webhook finds them: the receipt address, else the charge's billing address. */
const payer = (pi: Intent) => (pi.metadata?.email || pi.receipt_email || charge(pi)?.email || "").trim();

export type StripeCount = { dry: boolean; payments: number; refunds: number; already: number; noEmail: number; people: number };

/** Dry, it only counts what would be added. `payments` and `refunds` are the new ones; `already` were on the log. */
export async function importStripe(env: LeadStore, key: string, dry: boolean): Promise<StripeCount> {
  const seal = await sealer(env.LEADS_KEY);
  if (!env.INBOX || !seal) throw new Error("Leads need LEADS_KEY on the Worker.");
  const intents = (await all<Intent>(key, "/payment_intents?expand[]=data.latest_charge")).filter((pi) => pi.status === "succeeded");
  const refunds = (await all<Refund>(key, "/refunds")).filter((r) => r.status === "succeeded" && r.payment_intent);
  const byId = new Map(intents.map((pi) => [pi.id, pi]));

  const todo: { email: string; c: Change }[] = [];
  let noEmail = 0;
  for (const pi of intents) {
    if (pi.metadata?.proof) continue;
    const email = payer(pi);
    if (!email.includes("@")) { noEmail++; continue; }
    const deposit = isDeposit(pi);
    todo.push({
      email,
      c: {
        event: { at: iso(pi.created), kind: "payment", ref: pi.id, note: deposit ? "Deposit" : pi.description || "Stripe", amount: (pi.amount_received ?? pi.amount ?? 0) / 100 },
        name: pi.metadata?.name || charge(pi)?.name || undefined,
        past: true,
      },
    });
  }
  // Running total per intent, oldest first, the way charge.refunded reports amount_refunded.
  const sofar = new Map<string, number>();
  for (const r of [...refunds].sort((a, b) => a.created - b.created)) {
    const pi = byId.get(r.payment_intent!);
    const email = pi ? payer(pi) : "";
    const total = (sofar.get(r.payment_intent!) ?? 0) + r.amount;
    sofar.set(r.payment_intent!, total);
    if (!email.includes("@")) { noEmail++; continue; }
    const full = total >= (pi!.amount_received ?? pi!.amount ?? Infinity);
    todo.push({ email, c: { event: { at: iso(r.created), kind: "refund", ref: full ? `refund-${r.payment_intent}` : `refund-${r.payment_intent}-${total}`, note: "Stripe", amount: r.amount / 100 }, past: true } });
  }
  todo.sort((a, b) => a.c.event.at.localeCompare(b.c.event.at));

  // What each lead already has: its whole log, and the lead's own events (some predate the log; the lead keeps only its last 50).
  const had = new Map<string, Set<string>>();
  const people = new Set<string>();
  const count: StripeCount = { dry, payments: 0, refunds: 0, already: 0, noEmail, people: 0 };
  for (const { email, c } of todo) {
    const id = await seal.id(email);
    if (!had.has(id)) {
      const lead = await readLead(env.INBOX, seal, id);
      had.set(id, new Set([...(await readLog(env.INBOX, seal, id)), ...(lead?.events ?? [])].map((e) => `${e.kind}|${e.ref}`)));
    }
    const sig = `${c.event.kind}|${c.event.ref}`;
    if (had.get(id)!.has(sig)) { count.already++; continue; }
    had.get(id)!.add(sig);
    people.add(id);
    count[c.event.kind === "payment" ? "payments" : "refunds"]++;
    // No VAPID_KEY: an import never pings his devices.
    if (!dry) await recordLead({ INBOX: env.INBOX, LEADS_KEY: env.LEADS_KEY }, email, c);
  }
  count.people = people.size;
  return count;
}
