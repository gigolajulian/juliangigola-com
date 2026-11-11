import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fromWorker } from "@/lib/vouch";
import { syncGmail } from "@/lib/gmail-sync";
import { json } from "@/lib/http";

/* ── POST /api/leads/gmail: fold hello@'s new mail into leads ─────
 * Called every ten minutes by the booking Worker's cron (`worker/index.ts`)
 * over its SITE service binding, with BOOKING_SECRET as the bearer. Anyone
 * else gets a 401. See `lib/gmail-sync.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  // Hashes compared, so the check takes the same time however close a guess is.
  if (!(await fromWorker(request, env.BOOKING_SECRET))) return json({ error: "Not authorized." }, 401);
  if (!env.GCAL_OAUTH || !env.LEADS_KEY) return json({ error: "Not set up." }, 503);
  try {
    return json({ folded: await syncGmail(env) });
  } catch (e) {
    // Google's status and message only, never a token (`lib/gcal.ts`).
    console.error("gmail", String(e));
    return json({ error: "Gmail sync failed." }, 502);
  }
}
