import { readLog } from "@/lib/leads/activity-log";
import { sealedGate } from "@/lib/admin/gate";
import { json } from "@/lib/http";

/* GET `?id=<lead id>`: one client's whole activity log (`lib/leads/activity-log.ts`). Behind the /admin gate. */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const seal = g.s;
  return json({ log: await readLog(g.kv, seal, (new URL(request.url).searchParams.get("id") ?? "").replace(/^lead:/, "")) });
}
