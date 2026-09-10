import type { Metadata } from "next";
import { WorkIndex } from "@/components/work-index";
import { CallToAction } from "@/components/call-to-action";
import { COMMISSIONS, WORK_CATEGORY_LINKS } from "@/lib/work";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Commissioned photography — editorial, campaigns, portraits, artist imagery, and film. Selected projects with clients and credits.",
  alternates: { canonical: "/work" },
};

export default function WorkPage() {
  return (
    <>
    <div className="mx-auto w-full max-w-[100rem] px-6 pb-24 pt-28 sm:px-10 sm:pt-36">
      <header>
        <h1 className="title">
          Work
        </h1>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {COMMISSIONS.length} commissioned projects. Editorial, campaigns, portraits, artist
          imagery, and film.
        </p>
      </header>

      <WorkIndex projects={COMMISSIONS} categories={WORK_CATEGORY_LINKS} />
    </div>

    <CallToAction
      title="Commission a shoot"
      body="Editorial, campaign, or artist imagery. Send the brief and I'll come back with an approach, a crew, and a quote."
      type="editorial"
      secondary={{ href: "/studio", label: "How a commission runs" }}
    />
    </>
  );
}
