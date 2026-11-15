import { getCloudflareContext } from "@opennextjs/cloudflare";
import { webResponse } from "@/lib/proofs/delivery-serve";

/* Save for web: a final's 2000px copy as a download. On Cloudflare `worker.ts` answers this path before Next; this is for `next dev`. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; fid: string }> }) {
  const { id, fid } = await params;
  return webResponse(request, (await getCloudflareContext({ async: true })).env, id, fid);
}
