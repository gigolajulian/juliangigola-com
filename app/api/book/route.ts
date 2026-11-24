import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lockOp, parseBooking, type BookResult } from "@/lib/booking/engine";
import { manageLinks } from "@/lib/booking/token";
import { afterBooked, confirmOf } from "@/lib/booking/confirm";
import { alertHello } from "@/lib/email/hello-mail";
import { whenPT } from "@/lib/inbox";
import { bodyOf, json, limited, upstreamError } from "@/lib/http";

// Errors answer { error: string }, as every other booking route does.

/* ── a free call, booked by the site's own engine ─────────────────
 * The picker posts a call here. The lock rechecks the time and inserts
 * the event (`lib/booking/engine.ts`), then the Inbox, Notion and the
 * client's "You're in." mail follow. Paid
 * sessions never come here: they book from Stripe's webhook.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

/** The alert's call line: the Meet link for a video call, the number for a phone call, the place otherwise. */
const callLine = (r: { via?: string; where?: string; phone?: string }) =>
  r.via === "Video"
    ? r.where?.startsWith("http") ? `Video call: ${r.where}` : "Video call: no Meet link was made, add one in Calendar"
    : r.via === "Phone" || !r.where ? `Call: ring ${r.phone ?? "(no phone)"}` : `Where: ${r.where}`;

export async function POST(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  if (!env.GCAL_OAUTH || !env.BOOKING_LOCK) return json({ error: "Booking is off." }, 503);

  const slow = await limited(env.DEPOSIT_LIMIT, "book", request);
  if (slow) return slow;

  const raw = await bodyOf(request);
  const parsed = parseBooking(raw, true);
  if (!parsed.ok) return json({ error: parsed.reason }, 400);
  const b = parsed.booking;
  const via = raw?.via === "Phone" || raw?.via === "Video" ? raw.via : undefined;

  let out: BookResult;
  try {
    out = await lockOp(env, "book", { ...b, via });
  } catch (e) {
    return upstreamError("book", e, "Could not reach the calendar.");
  }
  if (!out.ok && out.reason === "unknown") return json({ error: "Unknown session." }, 400);
  if (!out.ok) return json({ error: "That time is already booked." }, 409);

  const r = out.record;
  await afterBooked(env, r, async () => ({ ...confirmOf(r, await manageLinks(env.BOOKING_SECRET, r)), call: true }), { defer: (p) => ctx.waitUntil(p) });
  ctx.waitUntil(alertHello(env.EMAIL, `Booked: ${[r.session, whenPT(r.start), r.name].join(", ")}`, [`${r.name} <${r.email}>`, ...(r.phone ? [`Phone: ${r.phone}`] : []), callLine(r), ...(r.notes ? ["", r.notes] : [])], { name: r.name, email: r.email }));
  return json({ status: "success", data: { uid: r.id, start: r.start, end: r.end, where: r.where } });
}
