import type { Metadata } from "next";
import { MOTION_SEO } from "@/lib/seo";
import { CONTENT } from "@/lib/content";
import { V3Video } from "@/components/v3/video";

/* ── /work/video ──────────────────────────────────────────────────
 * The moving work, as one more filter on the work index: the `(index)`
 * layout draws the head and the chip row with Motion lit, and the films
 * run across the strip under the chips where a discipline's covers would.
 *
 * Still a real route, at `/portfolio/video` and not `/portfolio/category/video`,
 * because it is not a listing of projects: there are no project pages
 * behind it, so the page is the work, the way `/portfolio/coverart` is.
 *
 * The strip opens on the reel, playing muted, then the music videos and
 * the commercials two rows deep, each film opening in the viewer, and it
 * ends on the ask and leads on to the about page.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  // Titled for the search, from `lib/seo.ts`; the page itself still says Motion.
  title: MOTION_SEO.title,
  description: MOTION_SEO.description,
  alternates: { canonical: "/portfolio/video" },
};

/* JG V3 (leftovers card D): the films as 16:9 tiles. The old strip
   (`VideoShowcase` in the work sheet) is retired, not deleted. */
export default function VideoPage() {
  return <V3Video videos={CONTENT.videos} />;
}
