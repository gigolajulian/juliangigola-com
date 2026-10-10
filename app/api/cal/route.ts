import { getCloudflareContext } from "@opennextjs/cloudflare";
import { bookingEnquiry, enquiryKey, summary, type CalBooking } from "@/lib/inbox";

/* ── Cal.com's booking webhook ─────────────────────────────────────
 * Every new booking, from the embed, the `?picker` or book.juliangigola.com,
 * stored in /admin's Inbox as a "booking" (`lib/inbox.ts`).
 *
 * Signed: Cal.com sends an HMAC-SHA256 of the body in `x-cal-signature-256`,
 * keyed with `CAL_WEBHOOK_SECRET`, and anything that does not match is
 * refused, so nobody else can write into the inbox through here. Refuses
 * everything while the secret is unset.
 *
 * A failed write answers 500 and Cal.com retries, which is the point: a
 * booking that could not be stored should be tried again, not dropped.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "cache-control": "no-store" } });

const bytes = (hex: string) =>
  Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const secret = env.CAL_WEBHOOK_SECRET;
  if (!secret || !env.INBOX) return text("Not set up.", 503);

  const body = await request.text();
  const sig = request.headers.get("x-cal-signature-256") ?? "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  // `verify` compares in constant time.
  if (
    !/^[0-9a-f]{64}$/i.test(sig) ||
    !(await crypto.subtle.verify("HMAC", key, bytes(sig), new TextEncoder().encode(body)))
  )
    return text("Bad signature.", 401);

  let hook: { triggerEvent?: string; payload?: CalBooking };
  try {
    hook = JSON.parse(body);
  } catch {
    return text("Not JSON.", 400);
  }
  // PING from the dashboard's test button, and every other trigger.
  if (hook.triggerEvent !== "BOOKING_CREATED") return text("ok", 200);

  const now = Date.now();
  const id = crypto.randomUUID();
  const stored = bookingEnquiry(hook.payload ?? {}, now, id);
  // ponytail: a retry after a write that succeeded stores the booking twice;
  // key on Cal's `uid` if that ever shows up in the inbox.
  await env.INBOX.put(enquiryKey(now, id.slice(0, 8)), JSON.stringify(stored), {
    metadata: summary(stored),
  });
  return text("ok", 200);
}
