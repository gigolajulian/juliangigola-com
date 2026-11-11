/**
 * The proofs desk's non-UI half (`components/proofs-astryx.tsx` and the
 * lead's proof card): the admin fetch and how a gallery's state reads.
 * Browser only, like `lib/leads/lead-desk.ts`.
 */
import { adminCall } from "@/lib/leads/lead-desk";
import { stage, type Proof } from "@/lib/proofs";

/** A gallery as `/api/proof?list` answers it, with its client link. */
export type Row = Proof & { url: string };

export const api = <T = Record<string, unknown>,>({ query = "", ...init }: RequestInit & { query?: string } = {}) => adminCall<T>(`/api/proof${query}`, init);

export const closed = (p: Proof) => !!p.closesAt && Date.parse(p.closesAt) < Date.now();
export const status = (p: Proof) => `${stage(p)}${p.checkout && !p.submittedAt ? ", paying" : ""}${closed(p) ? " · closed" : ""}`;
