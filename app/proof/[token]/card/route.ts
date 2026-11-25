import { sealedStore } from "@/lib/kv";
import { isToken } from "@/lib/proofs/proof-model";
import { readPublic } from "@/lib/proofs/proof-store";
import { shareCard } from "@/lib/proofs/watermark";
import { logged } from "@/lib/utils";

/* The gallery's link-preview card (`shareCard`). Only while the gallery is open and watermarked. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { env, seal, kv } = await sealedStore();
  if (!isToken(token) || !kv || !env.PROOFS || !seal) return new Response("Not found", { status: 404 });
  const p = await readPublic(kv, seal, token);
  if (!p) return new Response("Not found", { status: 404 });
  const c = await shareCard(env, p, request.url).catch(logged("proof card"));
  if (c === undefined) return new Response("Try again shortly", { status: 503, headers: { "retry-after": "5" } });
  if (!c) return new Response("Not found", { status: 404 });
  return new Response(c.body, {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "public, max-age=3600",
      "x-robots-tag": "noindex, nofollow, noimageindex",
      etag: c.etag,
    },
  });
}
