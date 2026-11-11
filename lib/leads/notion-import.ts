/* ── past Notion rows into the desk ──────────────────────────────────
 * Julian (2026-11-11, "go"): the Business Hub's Bookings and Clients CRM rows
 * become past leads. `scripts/import-notion.mjs` reads the export in
 * IMPORT/notion-archive/ and posts one record per person here. A field the
 * lead already has is never overwritten; each Notion row is one "added" line
 * (ref `notion:<row>`), so a second run adds nothing. Quiet: never unread,
 * never a push. A person he deleted for good (`gone:`) stays gone.
 * ─────────────────────────────────────────────────────────────── */
import type { Sealer } from "./lead-crypto";
import { readLead, writeLead } from "./lead-store";
import { PAPER, STAGES, type Lead, type LeadEvent, type Paper, type Stage } from "./leads";

type KV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;

/** What the script sends per person. Strings only, cut to size here. */
export type NotionPerson = {
  email: string;
  name?: string;
  phone?: string;
  ig?: string;
  company?: string;
  source?: string;
  kind?: string;
  notes?: string;
  quote?: number;
  contract?: string;
  /** For a new lead only: an existing lead keeps the stage he set. */
  stage?: string;
  rows: { ref: string; at: string; note: string }[];
};

export type NotionCount = { dry: boolean; created: number; filled: number; unchanged: number; gone: number; skipped: number; lines: number };

const FIELDS = ["name", "phone", "ig", "company", "source", "kind", "notes"] as const;
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const day = (v: unknown) => (typeof v === "string" && !isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined);

export async function importNotion(kv: KV, s: Sealer, people: unknown, dry: boolean): Promise<NotionCount> {
  const count: NotionCount = { dry, created: 0, filled: 0, unchanged: 0, gone: 0, skipped: 0, lines: 0 };
  if (!Array.isArray(people) || people.length > 500) throw new Error("Expected up to 500 people.");
  for (const raw of people as NotionPerson[]) {
    const email = str(raw?.email, 200)?.toLowerCase();
    const rows = (Array.isArray(raw?.rows) ? raw.rows : [])
      .map((r) => ({ ref: str(r?.ref, 80), at: day(r?.at), note: str(r?.note, 200) }))
      .filter((r): r is { ref: string; at: string; note: string } => !!(r.ref && r.at && r.note));
    if (!email || !rows.length) { count.skipped++; continue; }
    const id = await s.id(email);
    if ((await Promise.all((await s.ids(email)).map((i) => kv.get(`gone:${i}`)))).some(Boolean)) { count.gone++; continue; }

    const before = await readLead(kv, s, id);
    const fresh: LeadEvent[] = rows
      .filter((r) => !before?.events.some((e) => e.kind === "added" && e.ref === `notion:${r.ref}`))
      .map((r) => ({ at: r.at, kind: "added", ref: `notion:${r.ref}`, note: r.note }));
    const first = [...rows].sort((a, b) => a.at.localeCompare(b.at))[0].at;
    const stage = (STAGES as readonly string[]).includes(raw.stage ?? "") ? (raw.stage as Stage) : "Inquiry";
    const lead: Lead = before
      ? { ...before }
      : { email, name: email, stage, stageAt: first, firstAt: first, lastAt: first, unread: false, events: [] };
    let changed = fresh.length > 0;
    for (const f of FIELDS) {
      const v = str(raw[f], f === "notes" ? 4000 : 200);
      // The name only replaces the bare address the lead was made with.
      const empty = f === "name" ? !lead.name || lead.name.toLowerCase() === lead.email : !lead[f];
      if (v && empty) { lead[f] = v; changed = true; }
    }
    if (lead.quote === undefined && typeof raw.quote === "number" && raw.quote > 0 && raw.quote < 1e7) { lead.quote = raw.quote; changed = true; }
    if (!lead.contract && (PAPER as readonly string[]).includes(raw.contract ?? "")) { lead.contract = raw.contract as Paper; changed = true; }
    if (!changed) { count.unchanged++; continue; }
    lead.events = [...lead.events, ...fresh].sort((a, b) => a.at.localeCompare(b.at)).slice(-50);
    if (first < lead.firstAt) lead.firstAt = first;
    count[before ? "filled" : "created"]++;
    count.lines += fresh.length;
    if (!dry) await writeLead(kv, s, id, lead, before);
  }
  return count;
}
