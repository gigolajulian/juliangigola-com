import { gated, param, previewMail } from "@/lib/proofs/desk-api";

/* GET /api/proof/preview?token=X: the proof mail as it would go out, for the desk to show. */

export const dynamic = "force-dynamic";

export const GET = gated(async (g, request) => previewMail(g, param(request, "token")));
