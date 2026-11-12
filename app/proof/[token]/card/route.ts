import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/leads/lead-crypto";
import { isToken, findProof } from "@/lib/proofs/proof";
import { shareCard } from "@/lib/proofs/watermark";

/* The gallery's link-preview card (`shareCard`). Only while the gallery is open and watermarked. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const seal = sealer(env.LEADS_KEY);
  if (!isToken(token) || !env.INBOX || !env.PROOFS || !seal) return new Response("Not found", { status: 404 });
  const p = await findProof(env.INBOX, await seal, token);
  if (!p) return new Response("Not found", { status: 404 });
  const c = await shareCard(env, p, request.url).catch(() => undefined);
  if (c === undefined) return new Response("Try again shortly", { status: 503, headers: { "retry-after": "5" } });
  if (!c) return new Response("Not found", { status: 404 });
  return new Response(c.body, {
    headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=3600", "x-robots-tag": "noindex, nofollow, noimageindex", etag: c.etag },
  });
}
