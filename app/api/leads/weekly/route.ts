import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fromWorker } from "@/lib/vouch";
import { readMaster } from "@/lib/leads/activity-log";
import { sealer } from "@/lib/leads/lead-crypto";
import { everyLead } from "@/lib/leads/lead-store";
import { weeklyMail } from "@/lib/leads/weekly";
import { mail } from "@/lib/hello-mail";
import { json } from "@/lib/http";

/* ── POST /api/leads/weekly: the Monday mail to hello@ ────────────
 * Called by the booking Worker's cron (`worker/index.ts`), Monday 9 AM
 * Pacific, with BOOKING_SECRET as the bearer. `?dry` answers with the mail
 * and sends nothing. See `lib/leads/weekly.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await fromWorker(request, env.BOOKING_SECRET))) return json({ error: "Not authorized." }, 401);
  const seal = await sealer(env.LEADS_KEY);
  if (!env.INBOX || !seal) return json({ error: "Not set up." }, 503);
  const { subject, lines } = weeklyMail(await everyLead(env.INBOX, seal), await readMaster(env.INBOX, seal), Date.now());
  if (new URL(request.url).searchParams.has("dry")) return json({ subject, text: lines.join("\n") });
  return json({ sent: await mail(env.EMAIL, subject, lines) });
}
