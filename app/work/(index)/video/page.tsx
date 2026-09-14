import type { Metadata } from "next";
import Link from "next/link";
import { VideoHero } from "@/components/video-hero";
import { VideoShowcase } from "@/components/video-showcase";
import { CallToAction } from "@/components/call-to-action";
import { CONTENT } from "@/lib/content";
import { REEL, SECTIONS, inSection } from "@/lib/videos";

/* ── /work/video ──────────────────────────────────────────────────
 * The moving work, as one more filter on the work index: the `(index)`
 * layout draws the head and the chip row with Video lit, and the films
 * sit under the chips where a discipline's projects would be.
 *
 * Still a real route, at `/work/video` and not `/work/category/video`,
 * because it is not a listing of projects: there are no project pages
 * behind it, so the page is the work, the way `/work/coverart` is.
 *
 * The reel plays first, under the chips, on its own: muted until asked,
 * fullscreen on a press. Then the music videos and the commercials as
 * headings on the same page, each film opening in the viewer.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Video",
  description:
    "Music videos and commercials, directed and shot in the San Francisco Bay Area. Selected moving work with clients and credits.",
  alternates: { canonical: "/work/video" },
};

export default function VideoPage() {
  const videos = CONTENT.videos;

  return (
    <>
      <div className="mx-auto w-full max-w-[100rem] px-6 pb-24 sm:px-10">
        <div className="mt-8">
          <VideoHero videoId={REEL.videoId} title={REEL.title} year={REEL.year}>
            <p className="label text-white/70">
              {REEL.title} &middot; {REEL.year}
            </p>
          </VideoHero>
        </div>

        {videos.length === 0 ? (
          /* Not an error state and not a placeholder pretending to be
             work. Until a link is pasted into /admin the page says so
             plainly and sends the visitor to the stills. */
          <p className="mt-8 max-w-prose text-sm leading-relaxed text-muted-foreground">
            The rest of the moving work is not up here yet.{" "}
            <Link
              href="/contact"
              className="text-foreground underline decoration-border underline-offset-4 hoverable:hover:decoration-foreground"
            >
              Ask for more
            </Link>{" "}
            and it comes back the same day.
          </p>
        ) : (
          <VideoShowcase
            sections={SECTIONS.map((s) => ({
              id: s.id,
              name: s.name,
              films: inSection(videos, s.id),
            }))}
          />
        )}
      </div>

      <CallToAction
        title="Commission a film"
        body="Tell me what you have in mind and I'll come back with an approach and a quote."
        type="editorial"
        secondary={{ href: "/work", label: "See the stills" }}
      />
    </>
  );
}
