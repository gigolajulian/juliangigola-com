import { GuideView, guideMetadata } from "@/components/booking/guide";

/* /san-jose-photographer: words in `GUIDE_PAGES` (`lib/booking/service-pages.ts`). */

export const metadata = guideMetadata("san-jose-photographer");

export default function SanJosePage() {
  return <GuideView slug="san-jose-photographer" />;
}
