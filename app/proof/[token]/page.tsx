import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sealedStore } from "@/lib/kv";
import { checkPaid, finalize, recheckTransfer } from "@/lib/proofs/submit";
import { PAYMENTS_DOWN } from "@/lib/stripe";
import { headers } from "next/headers";
import { coverFrame, isToken, publicView, readPublic, shutReason, writeProof } from "@/lib/proofs/proof";
import { PassGate, Shut } from "@/components/proofs/pass-gate";
import { ProofGallery } from "@/components/proofs/gallery";
import { CARD } from "@/lib/proofs/watermark";

/* ── /proof/<token>: a client's private gallery ──────────────────
 * Unlisted: noindex, not in the sitemap, no site header or splash.
 * Coming back from Checkout (?paid=<session>), or opening the page while a
 * session is pending, checks Stripe and locks the selects when it is paid.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

const base: Metadata = {
  title: "Proofs",
  description: "Proofs from Julian Gigola.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

/** The link preview when the gallery is pasted into a text, DM or email: a card of the page's header and its first frame, watermarked. Never the client's name or address. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const { seal, kv } = await sealedStore();
  const p = isToken(token) && kv && seal ? await readPublic(kv, await seal, token) : null;
  const f = p && coverFrame(p);
  if (!f) return base;
  // The URL carries the frame and crop, so a new pick is a new URL and no app shows a stale preview.
  const crop = p.card?.id === f.id ? `&c=${p.card.x}-${p.card.y}-${p.card.w}` : "";
  const images = [{ url: `/proof/${token}/card?f=${encodeURIComponent(f.id)}${crop}`, width: CARD.w, height: CARD.h, alt: "Proofs by Julian Gigola" }];
  return { ...base, openGraph: { title: "Proofs | Julian Gigola", description: "Proofs from Julian Gigola.", url: `/proof/${token}`, images }, twitter: { card: "summary_large_image", images } };
}

export default async function ProofPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { token } = await params;
  const { paid } = await searchParams;
  const { env, seal, kv } = await sealedStore();
  if (!isToken(token) || !kv || !seal) return <Shut />;
  const s = await seal;
  let p = await readPublic(kv, s, token);
  // Delivered: the same shoot id now opens the finals.
  if (p?.deliveredAt) redirect(`/delivery/${token}`);
  // Offline or behind a password: nothing of the gallery is rendered until the gate's cookie is right.
  const why = await shutReason(p, (await headers()).get("cookie"), env.LEADS_KEY);
  if (why === "locked") return <PassGate id={token} kind="proofs" />;
  if (!p || why) return <Shut offline={why === "offline"} />;

  const session = paid ?? p.checkout;
  let notice: string | undefined;
  if (!p.submittedAt && session && env.STRIPE_SECRET_KEY) {
    const ok = await checkPaid(env.STRIPE_SECRET_KEY, p, session);
    if (ok === "down") notice = PAYMENTS_DOWN;
    else if (ok) p = await finalize(env, kv, s, p, ok);
  }
  if (p.paid?.pending && env.STRIPE_SECRET_KEY) {
    const moved = await recheckTransfer(env.STRIPE_SECRET_KEY, p).catch(() => null);
    if (moved) await writeProof(kv, s, (p = moved));
  }
  // Julian's own look before sending is not a client view.
  if (!paid && p.sentAt) await writeProof(kv, s, { ...p, views: p.views + 1, firstViewAt: p.firstViewAt ?? new Date().toISOString() });

  return <ProofGallery token={token} initial={publicView(p)} notice={notice} />;
}
