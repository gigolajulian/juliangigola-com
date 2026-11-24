import { clientsCsv } from "@/lib/leads/sync/sheet-sync";
import { readMaster } from "@/lib/leads/activity-log";
import { eventsCsv } from "@/lib/leads/lead-crm";
import { sealedGate } from "@/lib/admin/gate";
import { NO_STORE } from "@/lib/http";

/* GET every lead as CSV, or with `?events` every event on the activity log. Behind the /admin gate. */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await sealedGate(request);
  if (g.error) return g.error;
  const seal = g.s;
  const day = new Date().toISOString().slice(0, 10);
  const file = (body: string, name: string) =>
    new Response(body, {
      headers: {
        ...NO_STORE,
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${name}-${day}.csv"`,
      },
    });
  const master = await readMaster(g.kv, seal);
  if (new URL(request.url).searchParams.has("events")) return file(eventsCsv(master), "activity");
  return file(await clientsCsv(g.kv, seal, master), "leads");
}
