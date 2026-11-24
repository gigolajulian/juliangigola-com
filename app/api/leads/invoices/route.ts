import { everyLead } from "@/lib/leads/lead-store";
import { sealedGate } from "@/lib/admin/gate";
import { json } from "@/lib/http";

/* GET every invoice on every lead, newest first, for Money > Invoices and Today's overdue list. Trashed
   leads are left out. Behind the /admin gate. */

export const dynamic = "force-dynamic";

// shortcut: one KV get per lead; an invoice index if the desk ever holds thousands of leads.
export async function GET(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const seal = g.s;
  const invoices = (await everyLead(g.kv, seal))
    .filter((l) => !l.trashedAt)
    .flatMap((l) => (l.invoices ?? []).map((i) => ({ ...i, lead: l.id, name: l.name })))
    .sort((a, b) => b.at.localeCompare(a.at));
  return json({ invoices });
}
