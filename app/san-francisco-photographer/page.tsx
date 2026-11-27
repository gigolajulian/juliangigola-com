import { GuideView, guideMetadata } from "@/components/booking/guide";

/* /san-francisco-photographer: words in `GUIDE_PAGES` (`lib/booking/service-pages.ts`). */

export const metadata = guideMetadata("san-francisco-photographer");

export default function SanFranciscoPage() {
  return <GuideView slug="san-francisco-photographer" />;
}
