import type { Metadata } from "next";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { deliveryIn } from "@/lib/proofs/delivery-serve";
import { PassGate, Shut } from "@/components/proofs/pass-gate";
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
  const { env } = await getCloudflareContext({ async: true });
  const g = await deliveryIn(env, id, (await headers()).get("cookie"));
  if ("shut" in g) return g.shut === "locked" ? <PassGate id={id} kind="photos" /> : <Shut offline={g.shut === "offline"} />;
  return <DeliveryGallery id={id} initial={deliveryView(g.p)} />;
}
