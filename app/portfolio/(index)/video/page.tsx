import type { Metadata } from "next";
import { shareOg } from "@/lib/og/share";
import { MOTION_SEO } from "@/lib/og/seo";
import { CONTENT } from "@/lib/content";
import { VideoIndex } from "@/components/portfolio/video";

/* /portfolio/video: the films, as one more filter on the work index. Its
 * own route rather than a category, because there are no project pages
 * behind it: the page is the work. */

export const metadata: Metadata = {
  // Titled for the search, from `lib/og/seo.ts`; the page itself still says Motion.
  title: MOTION_SEO.title,
  description: MOTION_SEO.description,
  alternates: { canonical: "/portfolio/video" },
  ...shareOg("Video", "Music videos and commercials directed and shot by Julian Gigola."),
};

/* The films as 16:9 tiles. */
export default function VideoPage() {
  return <VideoIndex videos={CONTENT.videos} />;
}
