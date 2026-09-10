import Link from "next/link";
import Image from "next/image";
import { COVER_ART } from "@/lib/work";

/* ── cover art ────────────────────────────────────────────────────
 * Its own section because its format is its own: every frame is exactly 1:1,
 * because that is what a release needs. Folded into the selected-work grid
 * those squares would have to be cropped to a portrait cell, which is the one
 * thing you cannot do to a cover — the type and the logo live at the edges.
 *
 * So the grid is square and seamless. Records in a rack, not framed prints:
 * covers are a format people already know how to read in a block, and the
 * repetition is the point rather than something to break up.
 * ─────────────────────────────────────────────────────────────── */

/** Two full rows at the widest breakpoint. Enough to show range, not the archive. */
const SHOWN = 10;

export function CoverArt() {
  const project = COVER_ART;
  if (!project?.images.length) return null;

  const frames = project.images.slice(0, SHOWN);

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
          All {project.images.length} &rarr;
        </Link>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {frames.map((frame, i) => (
          <li key={frame.src}>
            <Link
              href={`/work/${project.slug}`}
              aria-label={`Cover art ${i + 1} of ${project.images.length}`}
              className="group relative block aspect-square overflow-hidden"
              style={{ backgroundColor: frame.color }}
            >
              <Image
                src={frame.src}
                alt={frame.alt || ""}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                loading="lazy"
                // The frames are already square, so the cell crops nothing.
                className="object-cover transition-opacity duration-300 ease-out hoverable:group-hover:opacity-80 motion-reduce:transition-none"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
