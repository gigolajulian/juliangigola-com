import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lock, recordBooking, type BookResult } from "@/lib/booking-engine";
import { manageLinks } from "@/lib/booking-token";
import { confirmMail, sendConfirm } from "@/lib/confirm";
import { logMail } from "@/lib/leads";
import { parseBooking } from "@/lib/deposit";

/* ── a free call, booked by the site's own engine ─────────────────
 * The picker under `?ownbook` posts the call here instead of to Cal.com's
 * `/v2/bookings`. The lock rechecks the time and inserts the event
 * (`lib/booking-engine.ts`), then the Inbox, Notion and the client's
 * "You're in." mail follow, as `/api/cal` does for Cal.com's. Paid
 * sessions never come here: they book from Stripe's webhook.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  if (!env.GCAL_OAUTH || !env.BOOKING_LOCK) return json({ status: "error", error: { message: "Booking is off." } }, 503);

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await env.DEPOSIT_LIMIT.limit({ key: `book:${ip}` })).success)
    return json({ status: "error", error: { message: "Too many tries. Wait a minute." } }, 429);

  const raw = (await request.json().catch(() => null)) as { via?: unknown } | null;
  const b = parseBooking(raw, true);
  if (typeof b === "string") return json({ status: "error", error: { message: b } }, 400);
  const via = raw?.via === "Phone" || raw?.via === "Video" ? raw.via : undefined;

  let out: BookResult;
  try {
    out = await lock<BookResult>(env, "book", { ...b, via });
  } catch {
    return json({ status: "error", error: { message: "Could not reach the calendar." } }, 502);
  }
  if (!out.ok) return json({ status: "error", error: { message: "That time is already booked." } }, 409);

  const r = out.record;
  const filed = recordBooking(env, r);
  ctx.waitUntil(filed);
  const confirm = { name: r.name, email: r.email, session: r.session, call: true, start: r.start, end: r.end, where: r.where, uid: r.id, manage: await manageLinks(env.BOOKING_SECRET, r) };
  // Logged after the lead is filed, so the mail lands on its row.
  if (await sendConfirm(env.CLIENT_EMAIL, confirm)) ctx.waitUntil(filed.then(() => logMail(env, r.email, confirmMail(confirm).subject, { to: "client", kind: "confirm", booking: r.id })));
  return json({ status: "success", data: { uid: r.id, start: r.start, end: r.end, where: r.where } });
}
