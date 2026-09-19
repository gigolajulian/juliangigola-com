import type { Metadata } from "next";
import { VideoShowcase } from "@/components/video-showcase";
import { EnquiryCell } from "@/components/enquiry-cell";
import { CONTENT } from "@/lib/content";
import { SECTIONS, inSection } from "@/lib/videos";
import { WORK_CATEGORY_LINKS } from "@/lib/work";

/* ── /work/video ──────────────────────────────────────────────────
 * The moving work, as one more filter on the work index: the `(index)`
 * layout draws the head and the chip row with Motion lit, and the films
 * run across the strip under the chips where a discipline's covers would.
 *
 * Still a real route, at `/work/video` and not `/work/category/video`,
 * because it is not a listing of projects: there are no project pages
 * behind it, so the page is the work, the way `/work/coverart` is.
 *
 * The strip opens on the reel, playing muted, then the music videos and
 * the commercials two rows deep, each film opening in the viewer, and it
 * ends on the ask and leads on to the about page.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Motion",
  description:
    "Music videos and commercials, directed and shot in the San Francisco Bay Area. Selected moving work with clients and credits.",
  alternates: { canonical: "/work/video" },
};

/* The filter before the films in the chip row, so pushing back off the
   start lands on it the way it does on every other filter. */
const BEFORE = (() => {
  const at = WORK_CATEGORY_LINKS.findIndex((c) => c.slug === "video");
  const prev = at > 0 ? WORK_CATEGORY_LINKS[at - 1] : undefined;
  return prev
    ? { href: prev.href, name: prev.name }
    : { href: "/work", name: "All work" };
})();

export default function VideoPage() {
  const videos = CONTENT.videos;

  return (
    <VideoShowcase
      prev={BEFORE}
      sections={SECTIONS.map((s) => ({
        id: s.id,
        name: s.name,
        films: inSection(videos, s.id),
      }))}
      /* No lead-on, for the reason `(index)/page.tsx` gives: the end of
         the films is the end of the films. */
      ask={
        <EnquiryCell
          key="enquire"
          title="Have a project in mind?"
          body="Tell me what you have in mind and I'll come back with an approach and a quote."
          type="editorial"
          secondary={{ href: "/work", label: "See the work" }}
          className="sm:w-[100vw] sm:px-[10vw]"
        />
      }
    />
  );
}
