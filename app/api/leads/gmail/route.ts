import { getCloudflareContext } from "@opennextjs/cloudflare";
import { bearer, digest } from "@/lib/vouch";
import { syncGmail } from "@/lib/gmail-sync";

/* ── POST /api/leads/gmail: fold hello@'s new mail into leads ─────
 * Called every ten minutes by the booking Worker's cron (`worker/index.ts`)
 * over its SITE service binding, with BOOKING_SECRET as the bearer. Anyone
 * else gets a 401. See `lib/gmail-sync.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const got = bearer(request);
  // Hashes compared, so the check takes the same time however close a guess is.
  if (!env.BOOKING_SECRET || !got || (await digest(got)) !== (await digest(env.BOOKING_SECRET))) return json({ error: "No." }, 401);
  if (!env.GCAL_OAUTH || !env.LEADS_KEY) return json({ error: "Not set up." }, 503);
  try {
    return json({ folded: await syncGmail(env) });
  } catch (e) {
    // Google's status and message only, never a token (`lib/gcal.ts`).
    console.error("gmail", String(e));
    return json({ error: "Gmail sync failed." }, 502);
  }
}
