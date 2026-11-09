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
    <div data-workbench data-lead-app className="w-full px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <LeadsAstryx />
    </div>
  );
}
