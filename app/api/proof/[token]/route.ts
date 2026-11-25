import { legacyPost, selectsPatch } from "@/lib/proofs/gallery-api";

/* ── proofs, the client's side ────────────────────────────────────
 * The token in the path is the only key; the email typed at the gate names who is picking.
 * PATCH saves that address's picks as they go. Each POST job has its own route beside this one:
 * `unlock` (the password), `track` (opens, looks, downloads) and `send` (the picks, and `{confirm}` after Checkout).
 * POST here still picks the job by body shape, for tabs opened before the split. Handlers: `lib/proofs/gallery-api.ts`.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ token: string }> };

export const PATCH = async (request: Request, { params }: Ctx) => selectsPatch((await params).token, request);
export const POST = async (request: Request, { params }: Ctx) => legacyPost((await params).token, request);
