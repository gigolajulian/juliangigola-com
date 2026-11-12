import { attachment, finalOf, openDelivery } from "@/lib/proofs/delivery";
import { finalKey, isFrameId } from "@/lib/proofs/proof";

/* One final, full size, as a download. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fid: string }> }) {
  const { id, fid } = await params;
  const g = isFrameId(fid) ? await openDelivery(id) : null;
  const f = g && finalOf(g.p, fid);
  if (!g || !f) return new Response("Not found", { status: 404 });
  if (!(await g.env.DOWNLOAD_LIMIT.limit({ key: request.headers.get("cf-connecting-ip") ?? "unknown" })).success) return new Response("Too many downloads. Wait a minute.", { status: 429, headers: { "retry-after": "60" } });
  const o = await g.env.PROOFS.get(finalKey(g.p.token, fid));
  if (!o) return new Response("Not found", { status: 404 });
  return new Response(o.body, {
    headers: { "content-type": "image/jpeg", "content-length": String(o.size), "content-disposition": attachment(f.file), "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
  });
}
