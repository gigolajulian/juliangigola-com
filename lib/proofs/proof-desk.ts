/**
 * The proofs desk's non-UI half (`components/proofs/desk.tsx` and the
 * lead's proof card): the admin fetch and how a gallery's state reads.
 * Browser only, like `lib/leads/lead-desk.ts`.
 */
import { adminCall } from "@/lib/admin/admin-call";
import { isTestEmail, stage, type CardCrop, type Proof, type ProofFrame } from "@/lib/proofs/proof-model";
import { CARD } from "@/lib/proofs/watermark";

/** A gallery as `/api/proof/list` answers it, with its client link. No password hash ever reaches the desk: only whether there is one. */
export type ProofRow = Omit<Proof, "pass"> & { url: string; hasPass?: boolean };

export const proofApi = <T = Record<string, unknown>,>({ path = "", ...init }: RequestInit & { path?: string } = {}) => adminCall<T>(`/api/proof${path}`, init);

export const pastCloseDate = (p: Proof) => !!p.closesAt && Date.parse(p.closesAt) < Date.now();
export const proofStatus = (p: Proof) => p.offline ? "Offline" : p.deliveredAt ? `Delivered${p.firstDownloadAt ? ", downloaded" : ""}${pastCloseDate(p) ? " · closed" : ""}` : `${stage(p)}${p.checkout && !p.submittedAt ? ", paying" : ""}${pastCloseDate(p) ? " · closed" : ""}`;

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

export type FeedItem = { at: string; token: string; gallery: string; email: string; who: string; what: string };

/**
 * Every gallery's client activity in one list for Today: opened, picked, sent, downloaded, newest
 * first. A run of picks by one address in one gallery reads as one line ("picked 4"). Test addresses (QA) are left out.
 */
export function feed(rows: Pick<Proof, "token" | "name" | "viewers" | "finals">[], n = 12): FeedItem[] {
  const out: FeedItem[] = [];
  for (const p of rows) {
    for (const [email, v] of Object.entries(p.viewers ?? {})) {
      if (isTestEmail(email)) continue;
      const who = v.name ?? email;
      let run: FeedItem | null = null, picks = 0;
      for (const e of v.events) {
        if (e.kind === "pick") {
          picks++;
          if (run) Object.assign(run, { at: e.at, what: `picked ${picks}` });
          else out.push((run = { at: e.at, token: p.token, gallery: p.name, email, who, what: "picked 1" }));
          continue;
        }
        if (e.kind === "unpick" || e.kind === "review" || e.kind === "pay") continue;
        run = null;
        picks = 0;
        const what = e.kind === "open" ? "opened" : e.kind === "send" ? "sent selects" : e.id === "all" ? "downloaded all" : `saved ${p.finals?.find((f) => f.id === e.id)?.file ?? "a photo"}`;
        out.push({ at: e.at, token: p.token, gallery: p.name, email, who, what });
      }
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, n);
}
