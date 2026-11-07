import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/lead-crypto";
import { frameKey, isFrameId, isOpen, isToken, readProof } from "@/lib/proofs";

/* One proof frame from the private bucket, only while its gallery is open.
   Cached in the visitor's browser only: a closed gallery stops serving on
   the next fetch. */
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ token: string; id: string }> }) {
  const { token, id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const seal = sealer(env.LEADS_KEY);
  if (!isToken(token) || !isFrameId(id) || !env.INBOX || !env.PROOFS || !seal) return new Response("Not found", { status: 404 });
  const p = await readProof(env.INBOX, await seal, token);
  if (!p || !isOpen(p) || !p.frames.some((f) => f.id === id)) return new Response("Not found", { status: 404 });
  const o = await env.PROOFS.get(frameKey(token, id));
  if (!o) return new Response("Not found", { status: 404 });
  return new Response(o.body, {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600", "x-robots-tag": "noindex, nofollow, noimageindex", etag: o.httpEtag },
  });
}
