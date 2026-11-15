import { getCloudflareContext } from "@opennextjs/cloudflare";
import { fromWorker } from "@/lib/vouch";
import { sealer } from "@/lib/leads/lead-crypto";
import { listProofs, readProof, type Proof } from "@/lib/proofs/proof";
import { digestMail } from "@/lib/email/proof-mail";
import { alertHello } from "@/lib/hello-mail";
import { json } from "@/lib/http";

/* ── POST /api/proof/daily: the galleries' daily summary to hello@ ─
 * Called by the booking Worker's hourly cron (`worker/index.ts`) at 9 AM
 * Pacific, with BOOKING_SECRET as the bearer. Covers galleries set to
 * "daily", from the last summary (or a day back) to now. The last run is
 * its own KV key, never a field on the galleries: a write here must not
 * race a client's picks. `?dry` answers with the mail and sends nothing.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";
const LAST = "proofdigest:last";

export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  if (!(await fromWorker(request, env.BOOKING_SECRET))) return json({ error: "Not authorized." }, 401);
  const seal = await sealer(env.LEADS_KEY);
  if (!env.INBOX || !seal) return json({ error: "Not set up." }, 503);
  const until = new Date().toISOString();
  const since = (await env.INBOX.get(LAST)) ?? new Date(Date.now() - 864e5).toISOString();
  const proofs = (await Promise.all((await listProofs(env.INBOX)).map((x) => readProof(env.INBOX!, seal, x.token)))).filter((p): p is Proof => p?.notify === "daily");
  const m = digestMail(proofs, since, until);
  if (new URL(request.url).searchParams.has("dry")) return json({ since, until, subject: m?.subject ?? null, text: m?.lines.join("\n") ?? null });
  const sent = m ? await alertHello(env.EMAIL, m.subject, m.lines) : false;
  // A failed send keeps the old mark, so tomorrow's summary still covers today.
  if (sent || !m) await env.INBOX.put(LAST, until);
  return json({ sent });
}
