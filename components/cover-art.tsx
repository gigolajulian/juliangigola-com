import Link from "next/link";
import { Reveal } from "@/components/reveal";
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
 * A full last row is the grid's job now, not the list's — see `columnsFor`.
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

/**
 * How many across on a wide screen, so the last row is full.
 *
 * Five when five divides the count, else four, else three, else five with a
 * short last row — which only a count like seven or eleven produces. Phones
 * stay at two, which every even pick divides. Written as whole class names
 * rather than built from a number, because Tailwind finds classes by reading
 * the source.
 */
const columnsFor = (n: number): string => {
  if (n % 5 === 0) return "lg:grid-cols-5";
  if (n % 4 === 0) return "lg:grid-cols-4";
  if (n % 3 === 0) return "lg:grid-cols-3";
  return "lg:grid-cols-5";
};

export function CoverArt() {
  const project = COVER_ART;
  if (!project?.images.length) return null;

  const releases = homepageReleases(CONTENT.coverArt);

  return (
    <section aria-labelledby="cover-art" className="border-t border-border">
      <Reveal variant="calm">
        <div className="mx-auto flex max-w-[100rem] items-baseline justify-between gap-6 px-6 pb-8 pt-20 sm:px-10 sm:pt-28">
          <div className="flex items-baseline gap-4">
            {/* Numbered to match the index on the cover, where cover art is 05. */}
            <span className="label tabular-nums text-muted-foreground">05</span>
            <h2 id="cover-art" className="label text-muted-foreground">
              Cover art
            </h2>
          </div>
          <Link
            prefetch={false}
            href={`/work/${project.slug}`}
            className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
          >
            All {COVER_RELEASES.length} &rarr;
          </Link>
        </div>
      </Reveal>

      {/* Two columns on a phone, and on a wide screen whatever divides the
          pick so the last row is full. */}
      {/* One reveal around the rack rather than one per sleeve. Ten squares
          arriving individually is confetti; the rack reads as a single shelf
          of records, so it arrives as one. */}
      <Reveal>
        <ul className={`grid grid-cols-2 ${columnsFor(releases.length)}`}>
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
                className="group relative block aspect-square overflow-hidden"
                style={{ backgroundColor: release.frames[0]?.color }}
              >
                <CoverFaces
                  frames={release.frames}
                  sizes="(min-width: 1024px) 20vw, 50vw"
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
      </Reveal>
    </section>
  );
}
