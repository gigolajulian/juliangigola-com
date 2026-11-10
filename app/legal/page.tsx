import type { Metadata } from "next";
import { shareOg } from "@/lib/share";
import { V3LegalPage } from "@/components/site/legal";
import { TermsColumn } from "@/components/site/terms";
import { PrivacyColumn } from "@/components/site/privacy";

export const metadata: Metadata = {
  title: "Legal",
  description:
    "The terms on which juliangigola.com and the photographs on it may be used, none of it as AI training data, and what the site knows about you.",
  alternates: { canonical: "/legal" },
  ...shareOg("Terms and privacy","The terms for juliangigola.com and the photographs on it, and what the site knows about you."),
};

/* The terms and the privacy policy on one page, a screen each, dealt as
   a deck (`components/site/legal.tsx`). The words live in
   `components/site/terms.tsx` and `components/site/privacy.tsx`; this is only the
   frame. The page opens whichever clause the address names, which the
   strip handles now, so the old `OpenOnHash` is not needed here. */
export default function LegalPage_() {
  return (
    <V3LegalPage>
      <TermsColumn />
      <PrivacyColumn />
    </V3LegalPage>
  );
}
