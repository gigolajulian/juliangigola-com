/* A contract's step on its lead: the Contract paper status and a timeline line. Server only. */
import type { Sealer } from "@/lib/leads/lead-crypto";
import type { InboxKV } from "@/lib/kv";
import { readLead, writeLead } from "@/lib/leads/lead-store";
import { applyLeadEvent, type LeadEvent, type Paper } from "@/lib/leads/leads";
import { notionPaper } from "@/lib/leads/sync/notion-lead";

/** Never throws: the contract is already stored, and a lead that failed to update must not undo a signature. */
export async function contractStep(kv: InboxKV, s: Sealer, leadId: string, paper: Paper, event: LeadEvent, notion?: string) {
  try {
    const before = await readLead(kv, s, leadId);
    if (!before) return null;
    // Sent is his own mail (a line, not news); Signed is from the client (news).
    const lead = { ...applyLeadEvent(before, before.email, { event }), contract: paper };
    const page = await notionPaper(notion, lead.email, { contract: paper }, lead.notion).catch(() => null);
    if (page) lead.notion = page;
    await writeLead(kv, s, leadId, lead, before);
    return lead;
  } catch (e) {
    console.error("contract lead", String(e));
    return null;
  }
}
