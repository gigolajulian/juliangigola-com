import { getCloudflareContext } from "@opennextjs/cloudflare";
import { finalResponse } from "@/lib/proofs/delivery-serve";

/* One final, full size, as a download. On Cloudflare `worker.ts` answers this path before Next; this is for `next dev`. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fid: string }> }) {
  const { id, fid } = await params;
  return finalResponse(request, (await getCloudflareContext({ async: true })).env, id, fid);
}
