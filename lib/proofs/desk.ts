/**
 * The proofs desk's non-UI half (`components/proofs/desk.tsx` and the
 * lead's proof card): the admin fetch and how a gallery's state reads.
 * Browser only, like `lib/leads/lead-desk.ts`.
 */
import { adminCall } from "@/lib/leads/lead-desk";
import { stage, type CardCrop, type Proof, type ProofFrame } from "@/lib/proofs/proof";
import { CARD } from "@/lib/proofs/watermark";

/** A gallery as `/api/proof?list` answers it, with its client link. */
export type Row = Proof & { url: string };

export const api = <T = Record<string, unknown>,>({ query = "", ...init }: RequestInit & { query?: string } = {}) => adminCall<T>(`/api/proof${query}`, init);

export const closed = (p: Proof) => !!p.closesAt && Date.parse(p.closesAt) < Date.now();
export const status = (p: Proof) => p.deliveredAt ? `Delivered${p.firstDownloadAt ? ", downloaded" : ""}${closed(p) ? " · closed" : ""}` : `${stage(p)}${p.checkout && !p.submittedAt ? ", paying" : ""}${closed(p) ? " · closed" : ""}`;

/** The widest box of the share card's photo shape that fits a frame. */
const cardBox = (f: Pick<ProofFrame, "w" | "h">) => {
  const shape = (CARD.w - CARD.photoLeft) / CARD.h, w = Math.min(f.w, Math.round(f.h * shape));
  return { w, h: Math.round(w / shape) };
};

/** The link-preview crop of one frame at `at` (0 top or left, 1 bottom or right). Null when Lightroom sent no size. */
export function cardCrop(f: Pick<ProofFrame, "id" | "w" | "h">, at: number): CardCrop | null {
  if (!f.w || !f.h) return null;
  const { w, h } = cardBox(f);
  return { id: f.id, x: Math.round((f.w - w) * at), y: Math.round((f.h - h) * at), w };
}

/** Where a saved crop sits, back on the 0..1 scale `cardCrop` takes. */
export function cropAt(f: Pick<ProofFrame, "w" | "h">, c: CardCrop): number {
  const { w, h } = cardBox(f);
  return f.w > w ? c.x / (f.w - w) : f.h > h ? c.y / (f.h - h) : 0.5;
}
