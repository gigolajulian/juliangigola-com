import { backfillLead, type InboxRow, type Lead, type Stage } from "@/lib/leads/leads";
import { readLead, writeLead } from "@/lib/leads/lead-store";
import type { Summary } from "@/lib/leads/enquiry";
import { sealedGate } from "@/lib/admin/gate";
import { everyKey } from "@/lib/kv";
import { bodyOf, json } from "@/lib/http";

/**
 * POST `{ dry? }`: the Inbox's `msg:` rows folded into leads (`backfillLead`). Dry, it only counts: how many
 * people, how many new, and the stage each would end on. Only an explicit `dry: false` writes. Rows stay,
 * nothing is mailed, Notion is not touched. A second run finds nothing to add.
 *
 * A lead deleted for good (Empty trash, or 30 days in it) leaves `gone:<id>` behind, so this does not bring it
 * back from the person's old rows. The id is the HMAC, never the address. A new message still starts a fresh lead.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const dry = (await bodyOf(request))?.dry !== false;
  const seal = g.s;

  const people = new Map<string, InboxRow[]>();
  for await (const k of everyKey<Summary>(g.kv, "msg:")) {
    const m = k.metadata;
    const email = m?.email?.trim().toLowerCase();
    if (!m || !email?.includes("@")) continue;
    people.set(email, [
      ...(people.get(email) ?? []),
      { key: k.name, at: m.at, type: m.type, name: m.name, email, read: m.read, detail: m.detail },
    ]);
  }

  const stages: Partial<Record<Stage, number>> = {};
  let added = 0;
  let updated = 0;
  for (const [email, rows] of people) {
    const id = await seal.id(email);
    const gone = await Promise.all((await seal.ids(email)).map((i) => g.kv.get(`gone:${i}`)));
    if (gone.some((x: string | null) => x !== null)) continue;
    const before = await readLead(g.kv, seal, id);
    const after: Lead | null = backfillLead(before, email, rows);
    if (!after) continue;
    if (before) updated++;
    else {
      added++;
      stages[after.stage] = (stages[after.stage] ?? 0) + 1;
    }
    if (!dry) await writeLead(g.kv, seal, id, after);
  }
  return json({ dry, people: people.size, added, updated, stages });
}
