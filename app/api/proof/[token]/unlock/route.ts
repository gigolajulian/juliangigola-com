import { BODY_MAX, unlock } from "@/lib/proofs/gallery-api";
import { bodyOf } from "@/lib/http";

/* The gallery's password gate (`components/proofs/pass-gate.tsx`): `{ password }`, rate-limited per address. */

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const b = (await bodyOf(request, BODY_MAX)) ?? {};
  return unlock((await params).token, request, b.password);
}
