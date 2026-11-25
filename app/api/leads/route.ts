import { buryLead, findLead, leadSummaries, openLead, trashedIds, UNOPENABLE, writeLead } from "@/lib/leads/lead-store";
import { manualLead } from "@/lib/leads/lead-crm";
import { patchLead } from "@/lib/leads/lead-patch";
import { gate, noSeal, sealedGate } from "@/lib/admin/gate";
import { bodyOf, json } from "@/lib/http";
import { logged } from "@/lib/utils";

/* ── the leads ───────────────────────────────────────────────────
 * The lead desk (`components/leads/desk.tsx`): one record per person, sealed
 * with LEADS_KEY (`lib/seal.ts`) and opened only on the server.
 * - GET: every lead's summary, newest first; `?id=` one lead whole. Trash empties itself here: the list is
 *   the desk's only reader, so a lead 30 days in the trash is deleted for good when it is read.
 * - PATCH `{ id, ... }`: a lead changed by hand (`patchLead`), by its plain id, never its KV key.
 * - POST: a lead added by hand (a DM, a text, a referral), name, email, ig, phone, company, kind, stage, source, notes (`manualLead`).
 * - DELETE: the trash emptied, every lead in it deleted for good.
 * The rest of the desk's data sits beside this route: push, templates,
 * invoices, invoice-from, invoice-photo, tasks, log, stats, csv, import.
 * A lead that will not open (a rotated LEADS_KEY) answers a JSON 500; the list leaves it out.
 * Behind the /admin gate (`lib/admin/gate.ts`), never cached.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const seal = g.s;
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const lead = await openLead(g.kv, seal, id);
    if (lead === undefined) return json({ error: UNOPENABLE }, 500);
    return lead ? json({ lead }) : json({ error: "Gone." }, 404);
  }
  const { leads, expired } = await leadSummaries(g.kv, seal, Date.now());
  await Promise.all(expired.map((x) => buryLead(g.kv, seal, x)));
  return json({ leads });
}

export async function PATCH(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const given = await bodyOf(request);
  if (!given) return json({ error: "Not JSON." }, 400);
  if (typeof given.id !== "string" || !given.id) return json({ error: "Unknown." }, 400);
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
  const had = await openLead(g.kv, seal, id);
  if (had === undefined) return json({ error: UNOPENABLE }, 500);
  if (had) return json({ error: "That person is already a lead.", id }, 409);
  const on = lead.email.includes("@") ? await findLead(g.kv, seal, lead.email).catch(logged("lead open")) : null;
  if (on === undefined) return json({ error: UNOPENABLE }, 500);
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
  const gone = await trashedIds(g.kv, g.s);
  await Promise.all(gone.map((id) => buryLead(g.kv, g.s, id)));
  return json({ ok: true, deleted: gone.length });
}
