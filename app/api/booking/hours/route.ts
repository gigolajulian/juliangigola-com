import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lockOp } from "@/lib/booking/engine";
import { cleanHours, type Hours } from "@/lib/booking/rules";
import { TZ } from "@/lib/time-zone";
import { refuseAdmin } from "@/lib/admin/vouch";
import { bodyOf, json, upstreamError } from "@/lib/http";

/* ── Julian's open hours, from the lead desk (Hours) ──────────────
 * GET the week and the dates that differ; PUT the whole thing back. Kept
 * in the booking lock, which every booking rechecks against. Opens with
 * the /admin gate: the admin key or a GitHub token
 * that can push to the repository.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

// The lock throws when it is unbound or down: answer the desk's {error} shape, as booking/[id] does.
async function held(ask: () => Promise<{ hours: Hours }>) {
  try {
    return json(await ask());
  } catch (e) {
    return upstreamError("hours", e, "Could not reach the booking lock. Try again.");
  }
}

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await refuseAdmin(request, env.INBOX_KEY);
  if (denied) return denied;
  return held(() => lockOp(env, "hours", null));
}

export async function PUT(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await refuseAdmin(request, env.INBOX_KEY);
  if (denied) return denied;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const hours = cleanHours(await bodyOf(request), today);
  if (!hours) return json({ error: "Those hours do not read right." }, 400);
  return held(() => lockOp(env, "setHours", hours));
}
