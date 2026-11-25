import { BODY_MAX, track } from "@/lib/proofs/gallery-api";
import { bodyOf } from "@/lib/http";

/* A gallery or delivery view logged: `{ email, kind?, id?, looks?, seconds?, name? }`. Limited on DOWNLOAD_LIMIT (60 a minute), which a viewer's 30 s flush never nears. */

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  return track((await params).token, request, (await bodyOf(request, BODY_MAX)) ?? {});
}
