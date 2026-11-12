import { getCloudflareContext } from "@opennextjs/cloudflare";
import { zipResponse } from "@/lib/proofs/delivery-serve";

/* Download all. On Cloudflare `worker.ts` answers this path before Next, which would drop its length; this is for `next dev`. */
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return zipResponse(request, (await getCloudflareContext({ async: true })).env, id);
}
