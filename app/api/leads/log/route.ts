import { readLog } from "@/lib/leads/activity-log";
import { sealedGate } from "@/lib/admin/gate";
import { json } from "@/lib/http";
import { logged } from "@/lib/utils";

/* GET `?id=<lead id>`: one client's whole activity log (`lib/leads/activity-log.ts`). Behind the /admin gate.
   A log that will not open (a rotated LEADS_KEY) is logged and answers a JSON 500. */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const seal = g.s;
  const id = (new URL(request.url).searchParams.get("id") ?? "").replace(/^lead:/, "");
  const log = await readLog(g.kv, seal, id).catch(logged("lead log open", id));
  return log ? json({ log }) : json({ error: "That log cannot be opened. LEADS_KEY may have changed." }, 500);
}
