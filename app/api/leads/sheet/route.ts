import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fromWorker } from "@/lib/vouch";
import { sealer } from "@/lib/leads/lead-crypto";
import { syncSheet } from "@/lib/leads/sheet-sync";
import { json } from "@/lib/http";

/* ── POST /api/leads/sheet: copy the lead desk to the Google Sheet ──
 * Called every ten minutes by the booking Worker's cron (`worker/index.ts`)
 * over its SITE service binding, with BOOKING_SECRET as the bearer. Anyone
 * else gets a 401. See `lib/leads/sheet-sync.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await fromWorker(request, env.BOOKING_SECRET))) return json({ error: "Not authorized." }, 401);
  const seal = await sealer(env.LEADS_KEY);
  if (!env.GCAL_OAUTH || !env.INBOX || !seal) return json({ error: "Not set up." }, 503);
  try {
    return json({ sheet: await syncSheet(env.INBOX, seal, env.GCAL_OAUTH) });
  } catch (e) {
    // Google's status only, never a token (`lib/booking/gcal.ts`).
    console.error("sheet", String(e));
    return json({ error: "Sheet sync failed." }, 502);
  }
}
