import Image from "next/image";
import { cn } from "@/lib/utils";
import type { CoverFrame } from "@/lib/cover-art-types";

/* ── the two sides of a sleeve ────────────────────────────────────
 * A release fills one square cell. Where it has two sides, side A is what the
 * cell shows and pointing at it turns the sleeve over.
 *
 * Same idea as the scrub tiles on the homepage — the cover tells you the
 * release exists, the second side tells you it is a whole sleeve rather than a
 * single square — but done in CSS rather than with pointer maths. Those tiles
 * scrub up to eight frames across six projects, which has to be fetched on
 * demand or it costs tens of megabytes. Here it is one extra picture on two of
 * twenty-four releases, so both sides are simply mounted and crossfaded: no
 * state, no pointer handlers, and the turn is instant the first time rather
 * than waiting on a request.
 *
 * `hoverable:` keeps it to real pointers. On a touch screen there is no hover
 * — a tap is a tap — and the second side is reachable from the lightbox.
 * Focus turns it too, so a keyboard visitor is not the one person who cannot
 * see the back.
 * ─────────────────────────────────────────────────────────────── */

export function CoverFaces({
  frames,
  sizes,
  priority = false,
}: {
  /** One frame, or two for a sleeve — side A first. */
  frames: CoverFrame[];
  sizes: string;
  priority?: boolean;
}) {
  const [front, back] = frames;
  if (!front) return null;

  return (
    <>
      <Image
        src={front.src}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className={cn(
          "object-cover transition-opacity duration-300 ease-out motion-reduce:transition-none",
          // With a back to show, the front gets out of the way entirely.
          // Without one, the dim is the hover feedback on its own.
          back
            ? "hoverable:group-hover:opacity-0 group-focus-visible:opacity-0"
            : "hoverable:group-hover:opacity-70",
        )}
      />

      {back ? (
        <>
          <Image
            src={back.src}
            alt=""
            fill
            sizes={sizes}
            // Never the priority image: it is invisible until someone asks
            // for it, and the front of the sleeve is what the page is for.
            loading="lazy"
            className="object-cover opacity-0 transition-opacity duration-300 ease-out hoverable:group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
          />

          {/* Two ticks, the way the scrub tiles mark position. This is the
              affordance as much as the indicator — it is what says there is a
              second side before anyone has pointed at the cover. */}
          <div aria-hidden className="absolute inset-x-4 bottom-3 hidden gap-1 hoverable:flex">
            <span className="h-px flex-1 bg-foreground transition-colors duration-300 group-hover:bg-foreground/30" />
            <span className="h-px flex-1 bg-foreground/30 transition-colors duration-300 group-hover:bg-foreground" />
          </div>
        </>
      ) : null}
    </>
  );
}

/** How a release reads to a screen reader, sides included. */
export function coverLabel(title: string, artist: string, frames: CoverFrame[]): string {
  const sides = frames
    .map((f) => f.side?.toLowerCase())
    .filter(Boolean)
    .join(" and ");
  return `${title} — ${artist}${sides ? `, ${sides}` : ""}`;
}
