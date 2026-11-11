import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lock } from "@/lib/booking-engine";
import { cleanHours, TZ, type Hours } from "@/lib/booking-rules";
import { isAdmin } from "@/lib/vouch";
import { json } from "@/lib/http";

/* ── Julian's open hours, from the lead desk (Hours) ──────────────
 * GET the week and the dates that differ; PUT the whole thing back. Kept
 * in the booking lock, which every booking rechecks against. Opens with
 * the same credentials as /api/inbox: the inbox key or a GitHub token
 * that can push to the repository.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

// The lock throws when it is unbound or down: answer the desk's {error} shape, as booking/[id] does.
async function held(env: CloudflareEnv, op: "hours" | "setHours", arg: Hours | null) {
  try {
    return json(await lock<{ hours: Hours }>(env, op, arg));
  } catch (e) {
    console.error("hours", String(e));
    return json({ error: "Could not reach the booking lock. Try again." }, 502);
  }
}

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await isAdmin(request, env.INBOX_KEY))) return json({ error: "Not authorized." }, 401);
  return held(env, "hours", null);
}

export async function PUT(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await isAdmin(request, env.INBOX_KEY))) return json({ error: "Not authorized." }, 401);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const hours = cleanHours(await request.json().catch(() => null), today);
  if (!hours) return json({ error: "Those hours do not read right." }, 400);
  return held(env, "setHours", hours);
}
