import Link from "next/link";
import { COVER_ART, COVER_RELEASES } from "@/lib/work";
import { CONTENT } from "@/lib/content";
import { CoverFaces, coverLabel } from "@/components/cover-faces";

/* ── cover art ────────────────────────────────────────────────────
 * Its own section because its format is its own: every frame is exactly 1:1,
 * because that is what a release needs. Folded into the selected-work grid
 * those squares would have to be cropped to a portrait cell, which is the one
 * thing you cannot do to a cover — the type and the logo live at the edges.
 *
 * So the grid is square and seamless. Records in a rack, not framed prints:
 * covers are a format people already know how to read in a block, and the
 * repetition is the point rather than something to break up.
 *
 * One cell per release, whether it has one side or two — a sleeve turns over
 * on hover rather than taking a second cell (see `cover-faces.tsx`), which
 * keeps every cell the same size and every row full.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Releases shown. It divides exactly by both column counts below, which is
 * the whole reason for the number: a seamless grid with a half-empty last row
 * shows page background through the gap, and that reads as a mistake rather
 * than as an edit.
 */
export const SHOWN = 10;

/**
 * The releases on the homepage: exactly the chosen ones, in that order.
 *
 * This used to top the picks up to `SHOWN` from the rest of the catalogue so
 * the grid was always full — and that is how a release Julian had not picked
 * turned up on his homepage: "WESTSIDE SHAWTY IS NOT IN THE ADMIN PANEL".
 * What the panel shows is what the page shows, full stop. Picking none is
 * the state before the rack could be curated and shows the first `SHOWN`.
 *
 * A full last row is the rack's job now, not the list's: it runs two rows
 * deep along the strip, so an even pick fills both and an odd one leaves a
 * single gap at its end.
 *
 * A slug matching nothing is dropped rather than throwing: `content/site.json`
 * is edited through a browser form, and `scripts/cover-art.mjs` regenerates
 * the release set, so a stale pick should cost its place in the rack and not
 * the build.
 */
const homepageReleases = (picked: readonly string[]) => {
  const bySlug = new Map(COVER_RELEASES.map((r) => [r.slug, r]));
  const chosen = picked
    .map((slug) => bySlug.get(slug))
    .filter((r): r is (typeof COVER_RELEASES)[number] => r !== undefined);
  return chosen.length ? chosen : COVER_RELEASES.slice(0, SHOWN);
};

/* Two cells of the homepage's strip: the heading, then the rack itself as
   one cell of two rows. Along the strip the sleeves are half its height
   each and the rack is as wide as that makes it; stacked on a phone they
   fall back into two columns down the page. */
export function CoverArt() {
  const project = COVER_ART;
  if (!project?.images.length) return null;

  const releases = homepageReleases(CONTENT.coverArt);

  return (
    <>
      <div
        data-tick
        data-label="Cover art"
        data-hash="cover-art"
        className="flex w-full shrink-0 flex-col justify-center gap-3 py-6 sm:h-full sm:w-[min(18rem,40vw)] sm:py-0"
      >
        <div className="flex items-baseline gap-4">
          {/* Numbered to match the index on the cover, where cover art is 05. */}
          <span className="label tabular-nums text-muted-foreground">05</span>
          <h2 id="cover-art" className="label text-muted-foreground">
            Cover art
          </h2>
        </div>
        <p className="font-display text-3xl uppercase leading-none tracking-[0] sm:text-4xl">
          Sleeves
        </p>
        <Link
          prefetch={false}
          href={`/work/${project.slug}`}
          className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
        >
          All {COVER_RELEASES.length} &rarr;
        </Link>
      </div>

      <div className="w-full shrink-0 sm:h-full sm:w-auto">
        <ul className="grid h-full grid-cols-2 gap-3 max-sm:grid-cols-2 sm:grid-flow-col sm:grid-cols-none sm:grid-rows-2">
          {releases.map((release) => (
            <li key={release.slug}>
              <Link
                prefetch={false}
                href={`/work/${project.slug}`}
                aria-label={coverLabel(
                  release.title,
                  release.artist,
                  release.frames,
                )}
                data-ring="Open"
                className="group relative block aspect-square overflow-hidden hoverable:cursor-none sm:h-full sm:w-auto"
                style={{ backgroundColor: release.frames[0]?.color }}
              >
                <CoverFaces
                  frames={release.frames}
                  sizes="(min-width: 640px) 18vw, 50vw"
                />

                {/* The release, named. A music client is scanning for something
                  they recognise, and a cover on its own does not say what it
                  is unless you already know it. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 border-t border-border/60 glass-surface bg-background/70 p-4 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                  <span className="label text-foreground">{release.title}</span>
                  <span className="label text-muted-foreground">
                    {release.artist}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
