import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/lead-crypto";
import { finalize, paidFor } from "@/lib/proof-submit";
import { isOpen, isToken, publicView, readProof, writeProof } from "@/lib/proofs";
import { ProofGallery } from "@/components/proof-gallery";

/* ── /proof/<token>: a client's private gallery ──────────────────
 * Unlisted: noindex, not in the sitemap, no site header or splash.
 * Coming back from Checkout (?paid=<session>), or opening the page while a
 * session is pending, checks Stripe and locks the selects when it is paid.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Proofs",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

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
  if (!p.submittedAt && session && env.STRIPE_SECRET_KEY) {
    const ok = await paidFor(env.STRIPE_SECRET_KEY, p, session).catch(() => null);
    if (ok) p = await finalize(env, env.INBOX, s, p, ok);
  }
  // Julian's own look before sending is not a client view.
  if (!paid && p.sentAt) await writeProof(env.INBOX, s, { ...p, views: p.views + 1, firstViewAt: p.firstViewAt ?? new Date().toISOString() });

  return <ProofGallery token={token} initial={publicView(p)} />;
}
