import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lock } from "@/lib/booking/booking-engine";
import { cleanHours, TZ, type Hours } from "@/lib/booking/booking-rules";
import { authorised, bearer, canPush } from "@/lib/vouch";

/* ── Julian's open hours, from the lead desk (Hours) ──────────────
 * GET the week and the dates that differ; PUT the whole thing back. Kept
 * in the booking lock, which every booking rechecks against. Opens with
 * the same credentials as /api/inbox: the inbox key or a GitHub token
 * that can push to the repository.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

async function allowed(request: Request, key?: string) {
  const given = request.headers.get("x-inbox-key");
  if (key && given) return authorised(request, key);
  const token = bearer(request);
  return !!token && (await canPush(token));
}

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await allowed(request, env.INBOX_KEY))) return json({ error: "Not authorized." }, 401);
  return json(await lock<{ hours: Hours }>(env, "hours", null));
}

export async function PUT(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await allowed(request, env.INBOX_KEY))) return json({ error: "Not authorized." }, 401);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const hours = cleanHours(await request.json().catch(() => null), today);
  if (!hours) return json({ error: "Those hours do not read right." }, 400);
  return json(await lock<{ hours: Hours }>(env, "setHours", hours));
}
