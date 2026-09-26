import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { TermsColumn } from "@/components/terms";
import { PrivacyColumn } from "@/components/privacy";

export const metadata: Metadata = {
  title: "Legal",
  description:
    "The terms on which juliangigola.com and the photographs on it may be used, none of it as AI training data, and what the site knows about you.",
  alternates: { canonical: "/legal" },
};

/* The terms and the privacy policy on one page, a screen each, dealt as
   a deck (`components/legal.tsx`). The words live in
   `components/terms.tsx` and `components/privacy.tsx`; this is only the
   frame. The page opens whichever clause the address names, which the
   strip handles now, so the old `OpenOnHash` is not needed here. */
export default function LegalPage_() {
  return (
    <LegalPage>
      <TermsColumn />
      <PrivacyColumn />
    </LegalPage>
  );
}
