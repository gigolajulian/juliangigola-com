import type { Metadata } from "next";
import { ProofsAstryx } from "@/components/proofs-astryx";

// The proofs desk (components/proofs-astryx.tsx). Out of the index like /admin. `data-lead-app`: no site header, as on the leads desk.
export const metadata: Metadata = {
  title: "PROOFS",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default function ProofsPage() {
  return (
    <div data-workbench data-lead-app className="w-full px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <ProofsAstryx />
    </div>
  );
}
