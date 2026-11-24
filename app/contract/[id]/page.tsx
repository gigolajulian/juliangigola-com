import type { Metadata } from "next";
import { sealedStore } from "@/lib/kv";
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
  const { seal, kv } = await sealedStore();
  // One that will not open (a rotated LEADS_KEY) shows the same not-available note, logged.
  const c = kv && seal ? await readContract(kv, seal, id).catch((e: unknown) => (console.error("contract page open", String(e)), null)) : null;
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
