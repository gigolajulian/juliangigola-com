import { everyLead } from "@/lib/leads/lead-store";
import { readMaster } from "@/lib/leads/activity-log";
import { stats } from "@/lib/leads/lead-crm";
import { gate, noSeal } from "@/lib/leads/desk-route";
import { json } from "@/lib/http";

/* GET the desk's numbers (`stats`, `lib/leads/lead-crm.ts`). Behind the /admin gate. */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await gate(request);
  if (g.error) return g.error;
  const seal = g.s;
  if (!seal) return noSeal();
  return json({ stats: stats(await everyLead(g.kv, seal), Date.now(), await readMaster(g.kv, seal)) });
}
