/* ── the activity log ─────────────────────────────────────────────
 * Julian (2026-11-10): "keep a master one and separate logs per client
 * linked to each other". A lead keeps only its last 50 events; every
 * event also lands here, in full, sealed with LEADS_KEY like the lead:
 *   log:<lead id>                 the client's whole log, oldest first
 *   logm:<at>:<lead id>:<rand>    one master entry per event; the sealed
 *                                 entry rides in the key's metadata, so the
 *                                 master reads by listing, with no get per event
 * A client entry carries its master key (`m`); a master entry its lead id.
 * Server only.
 * ─────────────────────────────────────────────────────────────── */

import type { Sealer } from "./lead-crypto";
import type { Lead, LeadEvent } from "./leads";

type KV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;
export type LogEntry = LeadEvent & { m: string };
export type MasterEntry = { lead: string; email: string; name: string; event: LeadEvent };

// shortcut: one sealed blob per client, capped; a paged log if a client ever passes it.
export const LOG_MAX = 5000;
/** Set when the log changes, so the next cron copies the desk to the Sheet (`lib/leads/sheet-sync.ts`). */
export const SHEET_DIRTY = "sheet:dirty";
/** KV metadata holds 1024 bytes; a longer note is cut in the master entry only. */
const META_MAX = 1000;
const sig = (e: LeadEvent) => `${e.at}|${e.kind}|${e.ref ?? ""}|${e.note ?? ""}`;

/** The events in `after` that `before` did not have. */
export function fresh(before: LeadEvent[] | undefined, after: LeadEvent[]): LeadEvent[] {
  const had = new Set((before ?? []).map(sig));
  return after.filter((e) => !had.has(sig(e)));
}

export async function readLog(kv: KV, s: Sealer, id: string): Promise<LogEntry[]> {
  const raw = await kv.get(`log:${id}`);
  return raw ? s.open<LogEntry[]>(raw) : [];
}

async function putMaster(kv: KV, s: Sealer, key: string, entry: MasterEntry) {
  let sealed = await s.seal(entry);
  if (JSON.stringify({ s: sealed }).length > META_MAX) sealed = await s.seal({ ...entry, name: entry.name.slice(0, 24), event: { ...entry.event, note: entry.event.note?.slice(0, 60), mail: undefined } });
  await kv.put(key, "", { metadata: { s: sealed } });
}

/** Appends to the client's log and the master log.
 * shortcut: read then write is not atomic, like recordLead; two writes for one person in the same second can drop a line. */
export async function appendLog(kv: KV, s: Sealer, id: string, lead: Pick<Lead, "email" | "name">, events: LeadEvent[]): Promise<void> {
  if (!events.length) return;
  const added: LogEntry[] = [];
  for (const event of events) {
    const m = `logm:${event.at}:${id}:${crypto.randomUUID().slice(0, 8)}`;
    await putMaster(kv, s, m, { lead: id, email: lead.email, name: lead.name, event });
    added.push({ ...event, m });
  }
  await kv.put(`log:${id}`, await s.seal([...(await readLog(kv, s, id)), ...added].slice(-LOG_MAX)));
  await kv.put(SHEET_DIRTY, "1");
}

/** A merge: the other record's log joins this one, and its master entries point here. */
export async function adoptLog(kv: KV, s: Sealer, into: string, from: string, lead: Pick<Lead, "email" | "name">): Promise<void> {
  const theirs = await readLog(kv, s, from);
  if (!theirs.length) return;
  for (const e of theirs) await putMaster(kv, s, e.m, { lead: into, email: lead.email, name: lead.name, event: e });
  const both = [...(await readLog(kv, s, into)), ...theirs].sort((a, b) => a.at.localeCompare(b.at)).slice(-LOG_MAX);
  await kv.put(`log:${into}`, await s.seal(both));
  await kv.delete(`log:${from}`);
}

/** A lead deleted for good: its log and its master entries go with it. */
export async function forgetLog(kv: KV, s: Sealer, id: string): Promise<void> {
  const log = await readLog(kv, s, id).catch(() => [] as LogEntry[]);
  await Promise.all(log.map((e) => kv.delete(e.m)));
  await kv.delete(`log:${id}`);
  await kv.put(SHEET_DIRTY, "1");
}

/** Every master entry, oldest first: one list call per 1000 events. */
export async function readMaster(kv: KV, s: Sealer): Promise<MasterEntry[]> {
  const out: MasterEntry[] = [];
  let cursor: string | undefined;
  for (;;) {
    const listed = await kv.list<{ s?: string }>({ prefix: "logm:", cursor });
    for (const k of listed.keys as { name: string; metadata?: { s?: string } }[]) {
      const e = k.metadata?.s ? await s.open<MasterEntry>(k.metadata.s).catch(() => null) : null;
      if (e) out.push(e);
    }
    if (listed.list_complete || !listed.cursor) break;
    cursor = listed.cursor;
  }
  return out;
}

export const cell = (v: unknown) => {
  let s = v === undefined || v === null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The master log as a CSV: one row per event. */
export function eventsCsv(rows: MasterEntry[]): string {
  const cols = ["time", "client", "email", "kind", "detail", "amount", "lead id"];
  const body = rows.map((r) => [r.event.at, r.name, r.email.includes("@") ? r.email : "", r.event.kind, r.event.note ?? r.event.mail?.kind ?? "", r.event.amount ?? "", r.lead].map(cell).join(","));
  return [cols.join(","), ...body].join("\r\n") + "\r\n";
}

/** What a client has paid, from their whole log: payments less refunds. */
export const paidTotal = (log: LeadEvent[]) => log.reduce((n, e) => n + (e.kind === "payment" ? e.amount ?? 0 : e.kind === "refund" ? -(e.amount ?? 0) : 0), 0);
