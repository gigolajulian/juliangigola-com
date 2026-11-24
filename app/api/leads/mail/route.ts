import { getCloudflareContext } from "@opennextjs/cloudflare";
import { logMail } from "@/lib/leads/lead-store";
import { refuseWorker } from "@/lib/admin/vouch";
import { bodyOf, json } from "@/lib/http";

/* ── POST /api/leads/mail: log a mail the booking Worker sent ─────
 * The lock Worker mails the day-before reminders but holds no lead key,
 * so it reports each one here over its SITE binding, with WORKER_KEY
 * as the bearer (as /api/leads/gmail). Body: { email, subject, kind, booking }.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await refuseWorker(request, env.WORKER_KEY);
  if (denied) return denied;
  const b = await bodyOf(request);
  if (!b || typeof b.email !== "string" || typeof b.subject !== "string" || typeof b.kind !== "string") return json({ error: "Bad mail." }, 400);
  const lead = await logMail(env, b.email, b.subject.slice(0, 200), { to: "client", kind: b.kind.slice(0, 40), booking: typeof b.booking === "string" ? b.booking.slice(0, 40) : undefined });
  return json({ logged: !!lead });
}
