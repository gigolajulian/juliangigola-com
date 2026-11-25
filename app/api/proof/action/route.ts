import { bodyIn, galleryAction, gated } from "@/lib/proofs/desk-api";

/* POST /api/proof/action {action, token, ...}: one job on one gallery.
   send, deliver, remind, relink, forget, reopen, extend, pulled. */

export const dynamic = "force-dynamic";

export const POST = gated(async (g, request) => galleryAction(g, await bodyIn(request), request));
