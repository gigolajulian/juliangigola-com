import { getCloudflareContext } from "@opennextjs/cloudflare";
import { refuseAdmin } from "@/lib/admin/vouch";
import { deskAction, isDeskAction } from "@/lib/booking/changes";
import { bodyOf, json } from "@/lib/http";

/* ── the lead desk changes a booking ──────────────────────────────
 * POST {action: "cancel-mine"} cancels with the whole deposit back;
 * POST {action: "no-show"} marks a no-show. The /admin gate only, never
 * the client's token: the client's own changes are `app/api/booking/[id]`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env } = await getCloudflareContext({ async: true });
  // Who is asking first, before the body is read.
  const denied = await refuseAdmin(request, env.INBOX_KEY);
  if (denied) return denied;
  const { id } = await params;
  const action = (await bodyOf(request))?.action;
  if (!isDeskAction(action)) return json({ error: "Nothing to do." }, 400);
  return deskAction(env, id, action);
}
