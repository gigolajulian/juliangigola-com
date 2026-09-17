import type { Metadata } from "next";
import { LegalPage } from "@/components/legal";
import { TermsColumn } from "@/components/terms";
import { PrivacyColumn } from "@/components/privacy";
import { OpenOnHash } from "@/components/open-on-hash";

export const metadata: Metadata = {
  title: "Legal",
  description:
    "The terms on which juliangigola.com and the photographs on it may be used, none of it as AI training data, and what the site knows about you.",
  alternates: { canonical: "/legal" },
};

/* Julian asked for the terms and the privacy policy on one page, in two
   columns. The words live in `components/terms.tsx` and
   `components/privacy.tsx`; this is only the frame. */
export default function LegalPage_() {
  return (
    <LegalPage>
      <OpenOnHash />
      <TermsColumn />
      <PrivacyColumn />
    </LegalPage>
  );
}
