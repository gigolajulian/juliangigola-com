import { everyLead } from "@/lib/leads/lead-store";
import { sealedGate } from "@/lib/leads/desk-route";
import { json } from "@/lib/http";

/* GET every open task on every lead, for Today's Tasks due. Trashed leads are left out. Behind the /admin gate. */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const seal = g.s;
  const tasks = (await everyLead(g.kv, seal))
    .filter((l) => !l.trashedAt)
    .flatMap((l) => (l.tasks ?? []).filter((t) => !t.doneAt).map((t) => ({ ...t, lead: l.id, name: l.name })));
  return json({ tasks });
}
