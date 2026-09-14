import type { Metadata } from "next";
import Link from "next/link";
import { VideoGrid } from "@/components/video-grid";
import { CallToAction } from "@/components/call-to-action";
import { CONTENT } from "@/lib/content";
import { REEL, SECTIONS, inSection, type Video } from "@/lib/videos";

/* ── /work/video ──────────────────────────────────────────────────
 * The moving work, as one more filter on the work index: the `(index)`
 * layout draws the head and the chip row with Video lit, and the films
 * sit under the chips where a discipline's projects would be. Julian
 * asked for it to sit inside the filters rather than beside them; it
 * used to open on a full-screen reel with no chips at all, so getting
 * back to the stills meant the browser's Back button.
 *
 * Still a real route, at `/work/video` and not `/work/category/video`,
 * because it is not a listing of projects: there are no project pages
 * behind it, so the page is the work, the way `/work/coverart` is.
 *
 * The reel opens the page as the first section, one film on its own;
 * the music videos and commercials follow as headings on the same page.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Video",
  description:
    "Music videos and commercials, directed and shot in the San Francisco Bay Area. Selected moving work with clients and credits.",
  alternates: { canonical: "/work/video" },
};

/** The reel as a tile, so it can sit in the same grid as the films. */
const REEL_TILE: Video = {
  id: "reel",
  title: REEL.title,
  provider: REEL.provider,
  videoId: REEL.videoId,
  section: "commercial",
  year: REEL.year,
  poster: REEL.poster,
};

export default function VideoPage() {
  const videos = CONTENT.videos;

  return (
    <>
      <div className="mx-auto w-full max-w-[100rem] px-6 pb-24 sm:px-10">
        {videos.length === 0 ? (
          /* Not an error state and not a placeholder pretending to be
             work. Until a link is pasted into /admin the page says so
             plainly and sends the visitor to the stills. */
          <p className="mt-8 max-w-prose text-sm leading-relaxed text-muted-foreground">
            The moving work is not up here yet.{" "}
            <Link
              href="/contact"
              className="text-foreground underline decoration-border underline-offset-4 hoverable:hover:decoration-foreground"
            >
              Ask for a reel
            </Link>{" "}
            and it comes back the same day.
          </p>
        ) : (
          <div className="mt-8 flex flex-col gap-16">
            {[
              { id: "reel", name: "Reel", films: [REEL_TILE] },
              ...SECTIONS.map((s) => ({
                id: s.id,
                name: s.name,
                films: inSection(videos, s.id),
              })),
            ].map((section) =>
              // A section with nothing in it is left out rather than drawn
              // empty: a heading over blank space reads as something failing
              // to load.
              section.films.length ? (
                <section key={section.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border pb-3">
                    <h2 className="font-display text-xl uppercase tracking-[0]">
                      {section.name}
                    </h2>
                    <p className="label text-muted-foreground">
                      {section.films.length}{" "}
                      {section.films.length === 1 ? "film" : "films"}
                    </p>
                  </div>
                  <VideoGrid videos={section.films} />
                </section>
              ) : null,
            )}
          </div>
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
