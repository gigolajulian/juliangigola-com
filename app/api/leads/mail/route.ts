import { getCloudflareContext } from "@opennextjs/cloudflare";
import { logMail } from "@/lib/leads";
import { bearer, digest } from "@/lib/vouch";

/* ── POST /api/leads/mail: log a mail the booking Worker sent ─────
 * The lock Worker mails the day-before reminders but holds no lead key,
 * so it reports each one here over its SITE binding, with BOOKING_SECRET
 * as the bearer (as /api/leads/gmail). Body: { email, subject, kind, booking }.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const got = bearer(request);
  if (!env.BOOKING_SECRET || !got || (await digest(got)) !== (await digest(env.BOOKING_SECRET))) return json({ error: "No." }, 401);
  const b = (await request.json().catch(() => null)) as { email?: unknown; subject?: unknown; kind?: unknown; booking?: unknown } | null;
  if (!b || typeof b.email !== "string" || typeof b.subject !== "string" || typeof b.kind !== "string") return json({ error: "Bad mail." }, 400);
  const lead = await logMail(env, b.email, b.subject.slice(0, 200), { to: "client", kind: b.kind.slice(0, 40), booking: typeof b.booking === "string" ? b.booking.slice(0, 40) : undefined });
  return json({ logged: !!lead });
}
