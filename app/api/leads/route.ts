import { trashDaysLeft, type LeadSummary } from "@/lib/leads/leads";
import { buryLead, findLead, readLead, writeLead } from "@/lib/leads/lead-store";
import { manualLead } from "@/lib/leads/lead-crm";
import { patchLead } from "@/lib/leads/lead-patch";
import { everyKey, gate, noSeal, sealedGate } from "@/lib/leads/desk-route";
import { bodyOf, json } from "@/lib/http";

/* ── the leads ───────────────────────────────────────────────────
 * The lead desk (`components/leads/desk.tsx`): one record per person, sealed
 * with LEADS_KEY (`lib/leads/lead-crypto.ts`) and opened only on the server.
 * - GET: every lead's summary, newest first; `?id=` one lead whole.
 * - PATCH `{ key: "lead:<id>", ... }`: a lead changed by hand (`patchLead`).
 * - POST: a lead added by hand (a DM, a text, a referral), name, email, ig, phone, company, kind, stage, source, notes (`manualLead`).
 * - DELETE: the trash emptied, every lead in it deleted for good.
 * The rest of the desk's data sits beside this route: push, templates,
 * invoices, invoice-from, invoice-photo, tasks, log, stats, csv, import.
 * Behind the /admin gate (`lib/leads/desk-route.ts`), never cached.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const seal = g.s;
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const lead = await readLead(g.kv, seal, id);
    return lead ? json({ lead }) : json({ error: "Gone." }, 404);
  }
  const leads: LeadSummary[] = [];
  for await (const k of everyKey<{ s?: string }>(g.kv, "lead:")) {
    if (!k.metadata?.s) continue;
    const one = await seal.open<LeadSummary>(k.metadata.s);
    // Trash empties itself: 30 days after it went in, the lead goes for good.
    // The list is the only reader, so it is the one place that checks.
    if (one.trashedAt && trashDaysLeft(one.trashedAt, Date.now()) <= 0) {
      await buryLead(g.kv, seal, k.name.slice(5));
      continue;
    }
    leads.push({ ...one, id: k.name.slice(5) });
  }
  return json({ leads: leads.sort((a, b) => b.lastAt.localeCompare(a.lastAt)) });
}

export async function PATCH(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const given = await bodyOf(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  if (typeof given.key !== "string" || !given.key.startsWith("lead:")) return json({ error: "Unknown." }, 400);
  const seal = g.s;
  if (!seal) return noSeal();
  const r = await patchLead(g.kv, seal, given, g.notion);
  return "error" in r ? json({ error: r.error }, r.status) : json({ lead: r.lead });
}

export async function POST(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const given = await bodyOf(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  const seal = g.s;
  if (!seal) return noSeal();
  const lead = manualLead(given, new Date().toISOString());
  if ("error" in lead) return json(lead, 400);
  const id = await seal.id(lead.email);
  if (await readLead(g.kv, seal, id)) return json({ error: "That person is already a lead.", id }, 409);
  const on = lead.email.includes("@") ? await findLead(g.kv, seal, lead.email) : null;
  if (on?.lead) return json({ error: `That address is on ${on.lead.name}'s lead.`, id: on.id }, 409);
  // A lead deleted for good left `gone:<id>` so an import does not bring it back; one added by hand clears it.
  await Promise.all((await seal.ids(lead.email)).map((i) => g.kv.delete(`gone:${i}`)));
  await writeLead(g.kv, seal, id, lead, null);
  return json({ lead, id });
}

/** "Empty trash": every lead in the trash, deleted for good. Their Inbox rows stay; the Inbox has its own trash. */
export async function DELETE(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const seal = g.s;
  const gone: string[] = [];
  for await (const k of everyKey<{ s?: string }>(g.kv, "lead:")) {
    if (k.metadata?.s && (await seal.open<LeadSummary>(k.metadata.s)).trashedAt) gone.push(k.name);
  }
  await Promise.all(gone.map((k) => buryLead(g.kv, seal, k.slice(5))));
  return json({ ok: true, deleted: gone.length });
}
