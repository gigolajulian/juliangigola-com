import type { Metadata } from "next";
import Link from "next/link";
import { VideoGrid } from "@/components/video-grid";
import { VideoHero } from "@/components/video-hero";
import { CallToAction } from "@/components/call-to-action";
import { CONTENT } from "@/lib/content";
import { REEL, SECTIONS, inSection } from "@/lib/videos";

/* ── /work/video ──────────────────────────────────────────────────
 * The moving work, in two sections: music videos and commercials.
 *
 * A real route rather than a filter on /work, for the same reason every other
 * discipline has one — it can be linked, sent to a client and indexed. It
 * sits at `/work/video` and not `/work/category/video` because it is not a
 * listing of projects: there are no separate project pages behind it, so the
 * page is the work, the way `/work/coverart` is.
 *
 * The two sections are headings on one page rather than two pages. Both
 * answer the same question — can he shoot moving work — and splitting six
 * videos across two routes is two thin pages instead of one that reads.
 * ─────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: "Video",
  description:
    "Music videos and commercials — directed and shot in the San Francisco Bay Area. Selected moving work with clients and credits.",
  alternates: { canonical: "/work/video" },
};

export default function VideoPage() {
  const videos = CONTENT.videos;

  return (
    <>
      {/* The reel opens the page: the whole screen, under the bar, with the
          page's own heading on its lower third.

          The heading belongs *on* the film rather than above or below it. A
          title above a video somebody has already started watching is a label
          on something they have moved past, and a title below it wastes the
          one screen that sells the page. This is the same move the cover
          makes, and it is plated the same way. */}
      <VideoHero videoId={REEL.videoId} title={REEL.title} year={REEL.year}>
        <div className="flex min-w-0 flex-col gap-2">
          <p className="label text-muted-foreground">
            {REEL.title} &middot; {REEL.year}
          </p>
          <h1 className="title">Video</h1>
          {/* Julian's line. It replaced "8 films. Music videos and
              commercials, directed and shot in the Bay Area" — the count is
              on each section's own heading, where it counts something the
              reader can see, and the disciplines are the two headings
              below. What was left worth saying is whose work it is. */}
          <p className="label text-muted-foreground">
            Directed &amp; shot by Julian Gigola
          </p>
        </div>
      </VideoHero>

      <div className="mx-auto w-full max-w-[100rem] px-6 pb-24 pt-16 sm:px-10 sm:pt-20">
        {videos.length === 0 ? (
          /* Not an error state and not a placeholder pretending to be work.
             The page exists so the discipline has somewhere to be the moment
             a link is pasted into /admin; until then it says so plainly and
             sends the visitor to the stills, which is where the work is. */
          <div className="mt-16 border-t border-border pt-10">
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              The moving work is not up here yet.{" "}
              <Link
                href="/contact"
                className="text-foreground underline decoration-border underline-offset-4 hoverable:hover:decoration-foreground"
              >
                Ask for a reel
              </Link>{" "}
              and it comes back the same day, or start with{" "}
              <Link
                href="/work"
                className="text-foreground underline decoration-border underline-offset-4 hoverable:hover:decoration-foreground"
              >
                the stills
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-14 flex flex-col gap-16">
            {SECTIONS.map((section) => {
              const inThis = inSection(videos, section.id);
              // A section with nothing in it is left out rather than drawn
              // empty: a heading over blank space reads as something failing
              // to load.
              if (!inThis.length) return null;

              return (
                <section key={section.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-border pb-3">
                    <h2 className="font-display text-xl uppercase tracking-[0]">
                      {section.name}
                    </h2>
                    <p className="label text-muted-foreground">
                      {inThis.length} {inThis.length === 1 ? "film" : "films"}
                    </p>
                  </div>

                  <VideoGrid videos={inThis} />
                </section>
              );
            })}
          </div>
        )}
      </div>

      <CallToAction
        title="Commission a film"
        body="A music video, a campaign cut, or stills and motion from the same day. Send the brief and I'll come back with a treatment, a crew, and a quote."
        type="editorial"
        secondary={{ href: "/work", label: "See the stills" }}
      />
    </>
  );
}
