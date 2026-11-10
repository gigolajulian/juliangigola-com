import type { Metadata } from "next";
import { LeadsAstryx } from "@/components/leads-astryx";

// The lead desk on Astryx, opt-in (components/leads-astryx.tsx). Out of the index like /admin/leads.
export const metadata: Metadata = {
  title: "LEADS",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default function LeadsAstryxPage() {
  return (
    // Edge to edge: the Astryx shell lays out its own header, nav and tab bar; only the iPhone notch and home bar are kept clear.
    <div data-workbench data-lead-app className="w-full pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <LeadsAstryx />
    </div>
  );
}
