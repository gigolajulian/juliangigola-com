import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lockOp, parseBooking, recordBooking, type BookResult } from "@/lib/booking/booking-engine";
import { manageLinks } from "@/lib/booking/booking-token";
import { sendConfirm } from "@/lib/booking/confirm";
import { logMail } from "@/lib/leads/lead-store";
import { json } from "@/lib/http";

// Errors answer { error: string }, as every other booking route does.

/* ── a free call, booked by the site's own engine ─────────────────
 * The picker posts a call here. The lock rechecks the time and inserts
 * the event (`lib/booking/booking-engine.ts`), then the Inbox, Notion and the
 * client's "You're in." mail follow. Paid
 * sessions never come here: they book from Stripe's webhook.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  if (!env.GCAL_OAUTH || !env.BOOKING_LOCK) return json({ error: "Booking is off." }, 503);

  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (!(await env.DEPOSIT_LIMIT.limit({ key: `book:${ip}` })).success)
    return json({ error: "Too many tries. Wait a minute." }, 429);

  const raw = (await request.json().catch(() => null)) as { via?: unknown } | null;
  const parsed = parseBooking(raw, true);
  if (!parsed.ok) return json({ error: parsed.reason }, 400);
  const b = parsed.booking;
  const via = raw?.via === "Phone" || raw?.via === "Video" ? raw.via : undefined;

  let out: BookResult;
  try {
    out = await lockOp(env, "book", { ...b, via });
  } catch (e) {
    console.error("book", String(e));
    return json({ error: "Could not reach the calendar." }, 502);
  }
  if (!out.ok && out.reason === "unknown") return json({ error: "Unknown session." }, 400);
  if (!out.ok) return json({ error: "That time is already booked." }, 409);

  const r = out.record;
  const filed = recordBooking(env, r);
  ctx.waitUntil(filed);
  const confirm = { name: r.name, email: r.email, session: r.session, call: true, start: r.start, end: r.end, where: r.where, uid: r.id, manage: await manageLinks(env.BOOKING_SECRET, r) };
  // Logged after the lead is filed, so the mail lands on its row.
  const sent = await sendConfirm(env.CLIENT_EMAIL, confirm);
  if (sent) ctx.waitUntil(filed.then(() => logMail(env, r.email, sent, { to: "client", kind: "confirm", booking: r.id })));
  return json({ status: "success", data: { uid: r.id, start: r.start, end: r.end, where: r.where } });
}
