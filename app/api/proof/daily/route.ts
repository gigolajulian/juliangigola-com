import { refuseWorker } from "@/lib/vouch";
import { sealedStore } from "@/lib/kv";
import type { Proof } from "@/lib/proofs/proof-model";
import { listProofs, readProof } from "@/lib/proofs/proof-store";
import { digestMail } from "@/lib/email/proof-mail";
import { alertHello } from "@/lib/email/hello-mail";
import { json } from "@/lib/http";

/* ── POST /api/proof/daily: the galleries' daily summary to hello@ ─
 * Called by the booking Worker's hourly cron (`worker/index.ts`) at 9 AM
 * Pacific, with WORKER_KEY as the bearer. Covers galleries set to
 * "daily", from the last summary (or a day back) to now. The last run is
 * its own KV key, never a field on the galleries: a write here must not
 * race a client's picks. `?dry` answers with the mail and sends nothing.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";
const LAST = "proofdigest:last";

export async function POST(request: Request) {
  const { env, seal, kv } = await sealedStore();
  const denied = await refuseWorker(request, env.WORKER_KEY);
  if (denied) return denied;
  if (!kv || !seal) return json({ error: "Not set up." }, 503);
  const until = new Date().toISOString();
  const since = (await kv.get(LAST)) ?? new Date(Date.now() - 864e5).toISOString();
  const proofs = (await Promise.all((await listProofs(kv)).map((x) => readProof(kv, seal, x.token)))).filter((p): p is Proof => p?.notify === "daily");
  const m = digestMail(proofs, since, until);
  if (new URL(request.url).searchParams.has("dry")) return json({ since, until, subject: m?.subject ?? null, text: m?.lines.join("\n") ?? null });
  const sent = m ? await alertHello(env.EMAIL, m.subject, m.lines) : false;
  // A failed send keeps the old mark, so tomorrow's summary still covers today.
  if (sent || !m) await kv.put(LAST, until);
  return json({ sent });
}
