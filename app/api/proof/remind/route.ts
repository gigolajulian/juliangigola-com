import { gated, param, remindPreview } from "@/lib/proofs/desk-api";

/* GET /api/proof/remind?token=X: the reminder for the gallery's stage as it would go out, with who gets it.
   Sending it is `POST /api/proof/action {action:"remind"}`. */

export const dynamic = "force-dynamic";

export const GET = gated(async (g, request) => remindPreview(g, param(request, "token")));
