/* Reading, writing and pushing leads (KV, LEADS_KEY, web push). Server only: the
 * desk's components import the pure model from `lib/leads/leads.ts`. */
import { sealer, type Sealer } from "./lead-crypto";
import { notify, pushFor } from "./lead-push";
import { appendLog, fresh } from "./activity-log";
import { fold, leadStoreKey, leadSummary, type Change, type Lead, type LeadSummary, type Sent } from "./leads";

/** The INBOX namespace as the lead, log, push, proof and sheet code use it. */
export type InboxKV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;
type KV = InboxKV;
/** Where leads live: the INBOX namespace, sealed with LEADS_KEY. */
export type LeadStore = { INBOX?: KV; LEADS_KEY?: string; VAPID_KEY?: string };

/** One lead, opened. Null when it is not there; throws when it cannot be opened (a rotated LEADS_KEY). */
export async function readLead(kv: KV, s: Sealer, id: string): Promise<Lead | null> {
  const raw = await kv.get(leadStoreKey(id));
  return raw ? s.open<Lead>(raw) : null;
}

/** Every lead, opened in full: for the numbers and the export, never the list.
    Throws if any one lead cannot be opened (a rotated LEADS_KEY), like `readLead`. */
export async function everyLead(inbox: KV, seal: Sealer) {
  const out: (Lead & { id: string })[] = [];
  let after: string | undefined;
  for (;;) {
    const listed = await inbox.list({ prefix: "lead:", cursor: after });
    for (const k of listed.keys) {
      const l = await readLead(inbox, seal, k.name.slice(5));
      if (l) out.push(Object.assign(l, { id: k.name.slice(5) }));
    }
    if (listed.list_complete) break;
    after = listed.cursor;
  }
  return out;
}

/** Bytes the sealed summary may take: KV metadata holds 1024, as JSON. */
const META_MAX = 1000;
/** What a summary gives up, in order, when non-Latin text makes it too big:
    the message, then most of the name, then most of the address. */
const SHRINK: ((m: LeadSummary) => LeadSummary)[] = [
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ({ snippet, dueText, ...m }) => ({ ...m, ...(m.licence ? { licence: { ...m.licence, use: "" } } : {}) }),
  (m) => ({ ...m, name: m.name.slice(0, 24) }),
  (m) => ({ ...m, name: m.name.slice(0, 8), email: m.email.slice(0, 40) }),
];

/** One lead, sealed, with its sealed summary as the metadata the list reads.
    The summary shrinks until it fits, so a long CJK name and message never
    make the put throw and the lead go unrecorded.
    `from`: the lead before this write (null for a new one); its new events go to the activity log. Left out (a move, a backfill), nothing is logged. */
export async function writeLead(kv: KV, s: Sealer, id: string, lead: Lead, from?: Lead | null): Promise<void> {
  let summary = leadSummary(lead);
  let meta = await s.seal(summary);
  for (const cut of SHRINK) {
    if (JSON.stringify({ s: meta }).length <= META_MAX) break;
    summary = cut(summary);
    meta = await s.seal(summary);
  }
  await kv.put(leadStoreKey(id), await s.seal(lead), { metadata: { s: meta } });
  // The log never blocks the lead: it is already stored.
  if (from !== undefined) await appendLog(kv, s, id, lead, fresh(from?.events, lead.events)).catch((e: unknown) => console.error("activity log", String(e)));
}

const CANON = "leads:canon";
/**
 * Once: moves each lead stored before ids ignored Gmail dots and "+tags"
 * (`canonical` in lib/leads/lead-crypto.ts, 2026-11-04) to its new id. A lead whose
 * new id is already taken stays put, for Merge on the desk. Returns how many moved.
 */
export async function canonLeads(kv: KV, s: Sealer): Promise<number> {
  if ((await kv.get(CANON)) !== null) return 0;
  let moved = 0;
  let cursor: string | undefined;
  for (;;) {
    const listed = await kv.list({ prefix: "lead:", cursor });
    for (const k of listed.keys) {
      // A lead that will not open stays put, like one whose new id is taken.
      const lead = await readLead(kv, s, k.name.slice(5)).catch((e: unknown) => (console.error("canon lead", k.name, String(e)), null));
      if (!lead?.email.includes("@")) continue;
      const id = await s.id(lead.email);
      if (leadStoreKey(id) === k.name || (await kv.get(leadStoreKey(id))) !== null) continue;
      await writeLead(kv, s, id, lead);
      await kv.delete(k.name);
      moved++;
    }
    if (listed.list_complete || !listed.cursor) break;
    cursor = listed.cursor;
  }
  await kv.put(CANON, new Date().toISOString());
  return moved;
}

/** Logs a mail the site sent against the person it was about. Never throws. */
export const logMail = (env: LeadStore, email: string | undefined, subject: string, mail: Sent) =>
  recordLead(env, email ?? "", { event: { at: new Date().toISOString(), kind: "mail", note: subject, mail } });

/**
 * Work that may run after the response: a push service can take seconds,
 * and the form, Cal.com and Stripe all wait on recordLead. In the Worker it
 * goes to waitUntil; with no request around it (tests, scripts) it runs
 * inline. Imported lazily so the desk's client bundle never loads it.
 */
async function later(p: Promise<void>) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    getCloudflareContext().ctx.waitUntil(p);
  } catch {
    await p;
  }
}

/**
 * Folds one event into the person's record and stores it, sealed. Without
 * LEADS_KEY nothing is recorded: never a lead in the clear.
 * shortcut: read, fold, write is not atomic, so two events for the same
 * person in the same second can lose one. Webhooks and the form for one
 * person are minutes apart; a Durable Object if that ever changes.
 */
export async function recordLead(env: LeadStore, email: string, c: Change): Promise<Lead | null> {
  const seal = sealer(env.LEADS_KEY);
  if (!env.INBOX || !email.includes("@")) return null;
  if (!seal) {
    console.error("lead", "LEADS_KEY unset or malformed, not recorded");
    return null;
  }
  try {
    const s = await seal;
    const id = await s.id(email);
    const before = await readLead(env.INBOX, s, id);
    const after = fold(before, email, c);
    if (after === before) return after;
    await writeLead(env.INBOX, s, id, after, before);
    // Something reached the site: ping his devices (`lib/leads/lead-push.ts`).
    const push = pushFor(after, c.event);
    if (push && env.VAPID_KEY) await later(notify(env.INBOX, env.VAPID_KEY, push));
    return after;
  } catch (e) {
    console.error("lead", String(e));
    return null;
  }
}
