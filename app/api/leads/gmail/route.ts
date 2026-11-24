import { getCloudflareContext } from "@opennextjs/cloudflare";
import { refuseWorker } from "@/lib/vouch";
import { syncGmail } from "@/lib/leads/sync/gmail-sync";
import { json, upstreamError } from "@/lib/http";

/* ── POST /api/leads/gmail: fold hello@'s new mail into leads ─────
 * Called every ten minutes by the booking Worker's cron (`worker/index.ts`)
 * over its SITE service binding, with WORKER_KEY as the bearer. Anyone
 * else gets a 401. See `lib/leads/sync/gmail-sync.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  // Hashes compared, so the check takes the same time however close a guess is.
  const denied = await refuseWorker(request, env.WORKER_KEY);
  if (denied) return denied;
  if (!env.GCAL_OAUTH || !env.LEADS_KEY) return json({ error: "Not set up." }, 503);
  try {
    return json({ folded: await syncGmail(env) });
  } catch (e) {
    // Google's status and message only, never a token (`lib/booking/gcal.ts`).
    return upstreamError("gmail", e, "Gmail sync failed.");
  }
}
