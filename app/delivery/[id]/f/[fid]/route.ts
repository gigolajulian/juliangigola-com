import { finalOf, openDelivery, servedPreview } from "@/lib/proofs/delivery";
import { isFrameId } from "@/lib/proofs/proof";

/* A final's web copy: 2000px, or 800px with `?w=800`. Never the full file; that is /dl. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fid: string }> }) {
  const { id, fid } = await params;
  const g = isFrameId(fid) ? await openDelivery(id) : null;
  if (!g || !finalOf(g.p, fid)) return new Response("Not found", { status: 404 });
  const small = new URL(request.url).searchParams.get("w") === "800";
  const o = await servedPreview(g.env, g.p.token, fid, small).catch(() => undefined);
  if (o === undefined) return new Response("Try again shortly", { status: 503, headers: { "retry-after": "5" } });
  if (!o) return new Response("Not found", { status: 404 });
  return new Response(o.body, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600", "x-robots-tag": "noindex, nofollow, noimageindex", etag: o.httpEtag } });
}
