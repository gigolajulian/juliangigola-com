import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lockOp, clientView, type ChangeResult } from "@/lib/booking/engine";
import { refuseAdmin } from "@/lib/admin/vouch";
import { tokenOpens } from "@/lib/booking/manage-link";
import { afterRescheduled } from "@/lib/booking/confirm";
import { cancelBooking } from "@/lib/booking/deposit";
import { deskAction, isDeskAction, refuseChange } from "@/lib/booking/changes";
import { bodyOf, json, limited, upstreamError } from "@/lib/http";

/* ── a client reschedules or cancels (`/booking/<id>`) ────────────
 * POST {t, action: "cancel"} or {t, action: "reschedule", start}. The
 * token from their mail opens it (`lib/booking/manage-link.ts`); the lock does
 * the change (`lib/booking/engine.ts`). A cancel 48 hours or more before
 * the start refunds the deposit through Stripe, 24 hours or more refunds 70%
 * of it, under that it keeps it (`refundShare`). hello@ hears about every change.
 * The lead desk's own changes have their route, `app/api/booking/[id]/desk`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { env } = await getCloudflareContext({ async: true });
  const { id } = await params;
  const body = (await bodyOf(request)) ?? {};
  // A desk tab loaded before the desk route existed still posts its two here: the admin gate, never the token.
  if (isDeskAction(body.action)) return (await refuseAdmin(request, env.INBOX_KEY)) ?? deskAction(env, id, body.action);
  if (!(await tokenOpens(env.BOOKING_SECRET, id, typeof body.t === "string" ? body.t : undefined))) return json({ error: "This link has expired. Reply to your confirmation email." }, 401);
  const slow = await limited(env.PUBLIC_WRITE_LIMIT, "booking", request);
  if (slow) return slow;

  let out: ChangeResult;
  try {
    if (body.action === "cancel") out = await lockOp(env, "cancel", id);
    else if (body.action === "reschedule" && typeof body.start === "string") out = await lockOp(env, "reschedule", { id, start: body.start });
    else return json({ error: "Nothing to do." }, 400);
  } catch (e) {
    return upstreamError("booking change", e, "Could not reach the calendar. Try again.");
  }
  if (!out.ok) return refuseChange(out.reason);

  const { record: r, was } = out;
  if (body.action === "reschedule") {
    await afterRescheduled(env, r, was);
    return json({ record: clientView(r) });
  }

  const { refunded, back } = await cancelBooking(env, r, was, "client");
  return json({ record: clientView(r), refunded: refunded ?? null, back });
}
