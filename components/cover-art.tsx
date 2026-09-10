import Link from "next/link";
import Image from "next/image";
import { COVER_ART, COVER_RELEASES } from "@/lib/work";
import type { CoverRelease } from "@/lib/cover-art-types";

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
 * A release with two sides gets one cell holding both, stacked — so a sleeve
 * reads as a sleeve rather than as two unrelated squares that happen to sit
 * next to each other. Those releases lead the set, which is also what keeps
 * the rows full at every column count.
 * ─────────────────────────────────────────────────────────────── */

/**
 * Cells, not releases — a two-sided release fills two of them.
 *
 * Ten divides exactly by both column counts below, which is the whole reason
 * for the number: a seamless grid with a half-empty last row shows page
 * background through the gap, and it reads as a mistake rather than as an
 * edit.
 */
const SHOWN = 10;

/** Releases up to `SHOWN` cells, never splitting a sleeve across the cut. */
function upTo(releases: CoverRelease[], cells: number): CoverRelease[] {
  const out: CoverRelease[] = [];
  let used = 0;
  for (const release of releases) {
    if (used + release.frames.length > cells) break;
    out.push(release);
    used += release.frames.length;
  }
  return out;
}

export function CoverArt() {
  const project = COVER_ART;
  if (!project?.images.length) return null;

  const releases = upTo(COVER_RELEASES, SHOWN);

  return (
    <section aria-labelledby="cover-art" className="border-t border-border">
      <div className="mx-auto flex max-w-[100rem] items-baseline justify-between gap-6 px-6 pb-8 pt-20 sm:px-10 sm:pt-28">
        <div className="flex items-baseline gap-4">
          {/* Numbered to match the index on the cover, where cover art is 05. */}
          <span className="label tabular-nums text-muted-foreground">05</span>
          <h2 id="cover-art" className="label text-muted-foreground">
            Cover art
          </h2>
        </div>
        <Link
          href={`/work/${project.slug}`}
          className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
        >
          All {COVER_RELEASES.length} &rarr;
        </Link>
      </div>

      {/* Two columns, then five — both divide SHOWN exactly, so the last row
          is always full. No three-column step in between: with the sleeves
          two rows deep, ten cells leave one stranded on a fourth row, and a
          gap in a seamless grid reads as a mistake rather than an edit. */}
      <ul className="grid grid-cols-2 lg:grid-cols-5">
        {releases.map((release) => {
          const sleeve = release.frames.length > 1;
          return (
            <li key={release.slug} className={sleeve ? "row-span-2" : undefined}>
              <Link
                href={`/work/${project.slug}`}
                // Named sides, not "front and back" — one of these sleeves
                // labels its own halves side A and side B.
                aria-label={`${release.title} — ${release.artist}${
                  sleeve ? `, ${release.frames.map((f) => f.side?.toLowerCase()).join(" and ")}` : ""
                }`}
                className="group relative block"
              >
                {/* One link over both sides, so a sleeve is one target. Each
                    half is a square the width of a column, so the two of them
                    stacked are exactly the two rows the cell spans. */}
                <div className={sleeve ? "grid grid-rows-2" : undefined}>
                  {release.frames.map((frame) => (
                    <div
                      key={frame.src}
                      className="relative aspect-square overflow-hidden"
                      style={{ backgroundColor: frame.color }}
                    >
                      <Image
                        src={frame.src}
                        alt=""
                        fill
                        // Same either way — stacking does not change how
                        // wide a half is.
                        sizes="(min-width: 1024px) 20vw, 50vw"
                        loading="lazy"
                        // The frames are already square, so the cell crops nothing.
                        className="object-cover transition-opacity duration-300 ease-out hoverable:group-hover:opacity-70 motion-reduce:transition-none"
                      />
                    </div>
                  ))}
                </div>

                {/* The release, named. Without it a sleeve's two halves are
                    indistinguishable from two unrelated covers side by side —
                    and a music client is looking for a name they know. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-background/90 to-transparent p-4 opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                  <span className="label text-foreground">{release.title}</span>
                  <span className="label text-muted-foreground">{release.artist}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
