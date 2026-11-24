import { refuseWorker } from "@/lib/vouch";
import { readMaster } from "@/lib/leads/activity-log";
import { sealedStore } from "@/lib/kv";
import { everyLead } from "@/lib/leads/lead-store";
import { weeklyMail } from "@/lib/leads/weekly";
import { alertHello } from "@/lib/email/hello-mail";
import { json } from "@/lib/http";

/* ── POST /api/leads/weekly: the Monday mail to hello@ ────────────
 * Called by the booking Worker's cron (`worker/index.ts`), Monday 9 AM
 * Pacific, with BOOKING_SECRET as the bearer. `?dry` answers with the mail
 * and sends nothing. See `lib/leads/weekly.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env, seal: sealing, kv } = await sealedStore();
  const denied = await refuseWorker(request, env.BOOKING_SECRET);
  if (denied) return denied;
  const seal = await sealing;
  if (!kv || !seal) return json({ error: "Not set up." }, 503);
  const { subject, lines } = weeklyMail(await everyLead(kv, seal), await readMaster(kv, seal), Date.now());
  if (new URL(request.url).searchParams.has("dry")) return json({ subject, text: lines.join("\n") });
  return json({ sent: await alertHello(env.EMAIL, subject, lines) });
}
