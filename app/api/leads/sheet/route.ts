import { refuseWorker } from "@/lib/vouch";
import { sealedStore } from "@/lib/kv";
import { syncSheet } from "@/lib/leads/sync/sheet-sync";
import { json, upstreamError } from "@/lib/http";

/* ── POST /api/leads/sheet: copy the lead desk to the Google Sheet ──
 * Called every ten minutes by the booking Worker's cron (`worker/index.ts`)
 * over its SITE service binding, with WORKER_KEY as the bearer. Anyone
 * else gets a 401. See `lib/leads/sync/sheet-sync.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env, seal: sealing, kv } = await sealedStore();
  const denied = await refuseWorker(request, env.WORKER_KEY);
  if (denied) return denied;
  const seal = await sealing;
  if (!env.GCAL_OAUTH || !kv || !seal) return json({ error: "Not set up." }, 503);
  try {
    return json({ sheet: await syncSheet(kv, seal, env.GCAL_OAUTH) });
  } catch (e) {
    // Google's status only, never a token (`lib/booking/gcal.ts`).
    return upstreamError("sheet", e, "Sheet sync failed.");
  }
}
