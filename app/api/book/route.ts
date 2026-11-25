import { getCloudflareContext } from "@opennextjs/cloudflare";
import { lockOp, parseBooking, type BookingRecord, type BookResult } from "@/lib/booking/engine";
import { manageLinks } from "@/lib/booking/manage-link";
import { afterBooked, confirmOf } from "@/lib/booking/confirm";
import { alertHello } from "@/lib/email/hello-mail";
import { whenPT } from "@/lib/time-zone";
import { sha256Hex } from "@/lib/token";
import { SMALL_BODY, bodyOf, json, limited, taken, upstreamError } from "@/lib/http";

// A booked call answers { id, start, end, where }; errors answer { error: string }, as every other booking route does.

/* ── a free call, booked by the site's own engine ─────────────────
 * The picker posts a call here. The lock rechecks the time and inserts
 * the event (`lib/booking/engine.ts`), then the Inbox, Notion, the
 * client's "You're in." mail and hello@'s alert follow the answer. Paid
 * sessions never come here: they book from Stripe's webhook.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

/** The alert's call line: the Meet link for a video call, the number for a phone call, the place otherwise. */
const callLine = (r: { via?: string; where?: string; phone?: string }) =>
  r.via === "Video"
    ? r.where?.startsWith("http")
      ? `Video call: ${r.where}`
      : "Video call: no Meet link was made, add one in Calendar"
    : r.via === "Phone" || !r.where
      ? `Call: ring ${r.phone ?? "(no phone)"}`
      : `Where: ${r.where}`;

export async function POST(request: Request) {
  const { env, ctx } = await getCloudflareContext({ async: true });
  if (!env.GCAL_OAUTH || !env.BOOKING_LOCK) return json({ error: "Booking is off." }, 503);

  const slow = await limited(env.PUBLIC_WRITE_LIMIT, "book", request);
  if (slow) return slow;

  const booked = await bookCall(env, await bodyOf(request, SMALL_BODY), request.headers.get("cf-connecting-ip") ?? "unknown");
  if (booked instanceof Response) return booked;
  // The visitor waits on the booking only: the filing, their mail and hello@'s alert follow the answer.
  ctx.waitUntil(afterCall(env, booked));
  ctx.waitUntil(alertBooked(env, booked));
  return json({ id: booked.id, start: booked.start, end: booked.end, where: booked.where });
}

/* A free call mails its address "You're in." from book@ and puts it on an invite, so a stranger could aim it at
   anyone. Booked calls a day: two per address, five per network address. Counted on a booking, kept two days. */
const CALLS_PER_EMAIL = 2;
const CALLS_PER_IP = 5;
const day = () => new Date().toISOString().slice(0, 10);
const callKeys = async (email: string, ip: string) => [
  `callcap:e:${(await sha256Hex(email.trim().toLowerCase())).slice(0, 32)}:${day()}`,
  `callcap:i:${(await sha256Hex(ip)).slice(0, 32)}:${day()}`,
];

/** The call checked and booked through the lock, or the answer refusing it. */
async function bookCall(env: CloudflareEnv, raw: unknown, ip: string): Promise<BookingRecord | Response> {
  const parsed = parseBooking(raw, true);
  if (!parsed.ok) return json({ error: parsed.reason }, 400);
  const kv = env.INBOX;
  if (!kv) return json({ error: "Booking is off." }, 503);
  const keys = await callKeys(parsed.booking.email, ip);
  const [byEmail, byIp] = await Promise.all(keys.map(async (k) => Number((await kv.get(k)) ?? 0)));
  if (byEmail >= CALLS_PER_EMAIL || byIp >= CALLS_PER_IP)
    return json({ error: "That's the most calls I take from one person in a day. Reply to your confirmation to change one." }, 429);
  let out: BookResult;
  try {
    out = await lockOp(env, "book", parsed.booking);
  } catch (e) {
    return upstreamError("book", e, "Could not reach the calendar.");
  }
  if (!out.ok && out.reason === "unknown") return json({ error: "Unknown session." }, 400);
  if (!out.ok) return taken();
  await Promise.all(keys.map((k, i) => kv.put(k, String([byEmail, byIp][i] + 1), { expirationTtl: 2 * 864e2 }))).catch((e: unknown) => console.error("call cap", String(e)));
  return out.record;
}

/** The lead desk's row, the client's "You're in." with its links, and that mail's log. */
const afterCall = (env: CloudflareEnv, r: BookingRecord) =>
  afterBooked(env, r, async () => ({ ...confirmOf(r, await manageLinks(env.BOOKING_SECRET, r)), call: true }));

/** hello@'s alert: who, how to reach them for the call, and their notes. */
function alertBooked(env: CloudflareEnv, r: BookingRecord) {
  const subject = `Booked: ${[r.session, whenPT(r.start), r.name].join(", ")}`;
  const lines = [`${r.name} <${r.email}>`, ...(r.phone ? [`Phone: ${r.phone}`] : []), callLine(r), ...(r.notes ? ["", r.notes] : [])];
  return alertHello(env.EMAIL, subject, lines, { who: { name: r.name, email: r.email } });
}
