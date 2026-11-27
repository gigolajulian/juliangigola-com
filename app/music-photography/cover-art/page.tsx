import { GuideView, guideMetadata } from "@/components/booking/guide";

/* /music-photography/cover-art: words in `GUIDE_PAGES` (`lib/booking/service-pages.ts`). */

export const metadata = guideMetadata("music-photography/cover-art");

export default function CoverArtPage() {
  return <GuideView slug="music-photography/cover-art" />;
}
