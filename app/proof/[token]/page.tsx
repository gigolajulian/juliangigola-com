import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/lead-crypto";
import { checkPaid, finalize, PAYMENTS_DOWN, settle } from "@/lib/proof-submit";
import { coverFrame, isOpen, isToken, publicView, readProof, writeProof } from "@/lib/proofs";
import { ProofGallery } from "@/components/proof-gallery";

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

/** The link preview when the gallery is pasted into a text, DM or email: its first frame, watermarked. Never the client's name or address. */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const seal = sealer(env.LEADS_KEY);
  const p = isToken(token) && env.INBOX && seal ? await readProof(env.INBOX, await seal, token) : null;
  const f = p && coverFrame(p);
  if (!f) return base;
  const images = [{ url: `/proof/${token}/f/${f.id}`, ...(f.w && f.h ? { width: f.w, height: f.h } : {}), alt: "" }];
  return { ...base, openGraph: { title: "Proofs | Julian Gigola", description: "Proofs from Julian Gigola.", url: `/proof/${token}`, images }, twitter: { card: "summary_large_image", images } };
}

function Closed() {
  return (
    <main className="grid min-h-svh place-items-center px-6 font-mono text-[13px] text-muted-foreground">
      <p>
        This gallery closed. <a href="mailto:hello@juliangigola.com" className="underline underline-offset-4">hello@juliangigola.com</a>
      </p>
    </main>
  );
}

export default async function ProofPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string }> }) {
  const { token } = await params;
  const { paid } = await searchParams;
  const { env } = await getCloudflareContext({ async: true });
  const seal = sealer(env.LEADS_KEY);
  if (!isToken(token) || !env.INBOX || !seal) return <Closed />;
  const s = await seal;
  let p = await readProof(env.INBOX, s, token);
  if (!p || !isOpen(p)) return <Closed />;

  const session = paid ?? p.checkout;
  let notice: string | undefined;
  if (!p.submittedAt && session && env.STRIPE_SECRET_KEY) {
    const ok = await checkPaid(env.STRIPE_SECRET_KEY, p, session);
    if (ok === "down") notice = PAYMENTS_DOWN;
    else if (ok) p = await finalize(env, env.INBOX, s, p, ok);
  }
  if (p.paid?.pending && env.STRIPE_SECRET_KEY) {
    const moved = await settle(env.STRIPE_SECRET_KEY, p).catch(() => null);
    if (moved) await writeProof(env.INBOX, s, (p = moved));
  }
  // Julian's own look before sending is not a client view.
  if (!paid && p.sentAt) await writeProof(env.INBOX, s, { ...p, views: p.views + 1, firstViewAt: p.firstViewAt ?? new Date().toISOString() });

  return <ProofGallery token={token} initial={publicView(p)} notice={notice} />;
}
