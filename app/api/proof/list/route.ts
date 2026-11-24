import { gated, listGalleries } from "@/lib/proofs/desk-api";

/* GET /api/proof/list: every gallery for the desk, opened, with its client link. */

export const dynamic = "force-dynamic";

export const GET = gated(async (g) => listGalleries(g));
