import type { Metadata } from "next";
import { openDelivery } from "@/lib/proofs/delivery";
import { deliveryView } from "@/lib/proofs/proof";
import { DeliveryGallery } from "@/components/proofs/delivery";

/* ── /delivery/<id>: a client's finished photos ──────────────────
 * Unlisted like /proof: noindex, no sitemap, no link preview image (the
 * finals are clean, so nothing of them goes into a share card).
 * ─────────────────────────────────────────────────────────────── */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your photos",
  description: "Photos from Julian Gigola.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
  referrer: "no-referrer",
};

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await openDelivery(id);
  if (!g) {
    return (
      <main className="grid min-h-svh place-items-center px-6 font-mono text-[13px] text-muted-foreground">
        <p>
          This gallery closed. <a href="mailto:hello@juliangigola.com" className="underline underline-offset-4">hello@juliangigola.com</a>
        </p>
      </main>
    );
  }
  return <DeliveryGallery id={id} initial={deliveryView(g.p)} />;
}
