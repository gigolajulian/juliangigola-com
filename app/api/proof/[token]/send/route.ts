import { BODY_MAX, send } from "@/lib/proofs/gallery-api";
import { bodyOf } from "@/lib/http";

/* The picks sent: `{ email, selects, method? }`, through Checkout when there are extras; `{ confirm }` checks that Checkout session on the way back. */

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  return send((await params).token, request, (await bodyOf(request, BODY_MAX)) ?? {});
}
