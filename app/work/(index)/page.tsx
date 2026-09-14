import type { Metadata } from "next";
import { WorkIndex } from "@/components/work-index";
import { CallToAction } from "@/components/call-to-action";
import { COMMISSIONS, indexRow } from "@/lib/work";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Commissioned photography: editorial, campaigns, portraits, artist imagery, and film. Selected projects with clients and credits.",
  alternates: { canonical: "/work" },
};

/** Everything. The head and the chips are the layout's; this is the list. */
export default function WorkPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-[100rem] px-6 pb-24 sm:px-10">
        <WorkIndex projects={COMMISSIONS.map(indexRow)} />
      </div>

      {/* Over the pinned head in the stack, so at the end of the list this
          slides up over it and the head is gone with the list. */}
      <div className="relative z-30 bg-background">
        <CallToAction
          title="Commission a shoot"
          body="Tell me what you have in mind and I'll come back with an approach and a quote."
          type="editorial"
          secondary={{ href: "/studio", label: "How a commission runs" }}
        />
      </div>
    </>
  );
}
