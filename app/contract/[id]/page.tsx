import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { sealer } from "@/lib/leads/lead-crypto";
import { publicContract, readContract } from "@/lib/contracts/contract";
import { ContractSign } from "@/components/contracts/sign";

/* ── /contract/<id>: a contract to sign ──────────────────────────
 * Unlisted like /delivery: noindex, no sitemap, no link preview. Only a sent
 * contract opens; a draft is a 404 to everyone but the desk.
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contract",
  description: "A contract from Julian Gigola.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = await getCloudflareContext({ async: true });
  const seal = sealer(env.LEADS_KEY);
  const c = env.INBOX && seal ? await readContract(env.INBOX, await seal, id) : null;
  if (!c?.sentAt) {
    return (
      <main className="grid min-h-svh place-items-center px-6 font-mono text-[13px] text-muted-foreground">
        <p>
          This contract is not available. <a href="mailto:hello@juliangigola.com" className="underline underline-offset-4">hello@juliangigola.com</a>
        </p>
      </main>
    );
  }
  return <ContractSign id={id} initial={await publicContract(c)} />;
}
