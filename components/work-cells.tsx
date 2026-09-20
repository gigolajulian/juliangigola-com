import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Frame } from "@/lib/work-types";

/* ── the words between the covers ─────────────────────────────────
 * The work strip runs discipline by discipline, and each discipline opens
 * on its name: a cell of words before its run of covers, the way a chapter
 * opens on a title page. It carries the count and the way to that
 * discipline's own page, and it is what the chips at the top jump to.
 * ─────────────────────────────────────────────────────────────── */

export function GroupCell({
  name,
  count,
  href,
  hash,
  i,
  cta = "All projects",
}: {
  name: string;
  /** Already worded: "18 projects", "8 films". */
  count: string;
  href: string;
  hash: string;
  /** Its place in the strip, for the stagger of the arrival. */
  i: number;
  /* Julian: "All editorial" under a chapter of the all work page read as
     a link that does nothing, because all the editorial covers are
     already there. The press narrows the page to the discipline, and the
     name of the discipline is set large directly above. */
  cta?: string;
}) {
  return (
    <div
      data-tick
      data-ring=""
      data-label={name}
      data-name={name}
      data-hash={hash}
      className="strip-cell flex w-full shrink-0 flex-col justify-center gap-4 py-10 max-sm:gap-2.5 max-sm:py-5 sm:h-full sm:w-[min(22rem,50vw)] sm:py-0 sm:pl-10 sm:pr-4"
      style={{ "--i": i } as React.CSSProperties}
    >
      <h2
        style={{ "--n": name.length } as React.CSSProperties}
        className="chapter-name font-display uppercase leading-[0.95] tracking-[0]"
      >
        {name}
      </h2>
      <p className="label text-muted-foreground">{count}</p>
      <Link
        prefetch={false}
        href={href}
        className="label w-fit border-b border-border pb-1 text-muted-foreground transition-colors duration-200 hoverable:hover:border-foreground hoverable:hover:text-foreground"
      >
        {cta}
      </Link>
    </div>
  );
}

/* ── one frame of a discipline that is a gallery ──────────────────
 * Four disciplines are a set of photographs rather than a list of
 * projects: Julian shoots them straight onto the page instead of making a
 * project for each. On the index they used to be one cover standing for
 * the whole set, so Event coverage and Automotive read as a single
 * picture. They run out in full now, the way a discipline of projects runs
 * out in covers, and every frame leads to the discipline's own page.
 *
 * Its own shape, like a cover: what varies along the strip is the ratio of
 * the photograph. The rack squares them all to 4:5, which is the rule
 * every other cell in it follows.
 *
 * A button, not a link: Julian asked that a single photograph dumped on a
 * discipline open in the viewer here, the way a project's frames do on its
 * own page. The discipline's own page is still one press away, on the
 * cover that opens the run and on the chip above.
 * ─────────────────────────────────────────────────────────────── */
/* ── one film of the motion work ──────────────────────────────────
 * A poster at the strip's height, 16:9 because that is what a film is,
 * and a tick of its own so the ruler's Motion chapter opens into the
 * films the way Editorial opens into its covers. A link to the films
 * page and not a viewer: the page is where a film plays.
 * ─────────────────────────────────────────────────────────────── */
export function FilmCell({
  title,
  poster,
  href,
  i,
  eager = false,
}: {
  title: string;
  /** The still, or nothing: a Vimeo film whose still was never looked
      up draws its own ground rather than a broken picture. */
  poster: string | null;
  href: string;
  /** Its place in the strip, for the stagger of the arrival. */
  i: number;
  eager?: boolean;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      data-tick
      data-name={title}
      data-ring="See the films"
      data-film
      aria-label={`${title}, film`}
      className="group strip-cell relative block aspect-video w-full shrink-0 overflow-hidden bg-card press active:scale-[0.995] sm:h-full sm:w-auto"
      /* A film is 16:9 and says so. In the strip the cell is full height and
         `aspect-video` settles its width, but the rack overrules both with
         `height: 100%` and a width read off `--ar` — and a cell that names no
         ratio falls back to the 0.8 a cover has. Every film in the rack was
         drawn as a 4:5 column with its still cropped to the middle. Julian:
         in the grid view the videos must be horizontal. */
      style={{ "--i": i, "--ar": "1.7778" } as React.CSSProperties}
    >
      {poster ? (
        <Image
          data-fade=""
          src={poster}
          alt=""
          fill
          sizes="(min-width: 640px) calc((100vh - 10rem) * 1.778), 100vw"
          loading={eager ? "eager" : "lazy"}
          draggable={false}
          className="strip-frame object-cover"
          // A 16:9 still from the provider's CDN rather than a frame from
          // the archive. The loader sizes it to the slot like anything else.
        />
      ) : null}
    </Link>
  );
}

export function FrameCell({
  frame,
  n,
  name,
  i,
}: {
  frame: Frame;
  /** Its place in the page's own list of gallery frames: the strip reads
      it off the press and hands it to the viewer. */
  n: number;
  /** The discipline, for the label a screen reader reads. */
  name: string;
  /** Its place in the strip, for the stagger of the arrival. */
  i: number;
}) {
  return (
    <button
      type="button"
      data-n={n}
      data-ring="Zoom in"
      aria-label={frame.alt || `${name}, frame ${n + 1}`}
      className="group strip-cell relative block w-full shrink-0 overflow-hidden press active:scale-[0.995] sm:h-full sm:w-auto"
      style={
        {
          backgroundColor: frame.color,
          aspectRatio: `${frame.width} / ${frame.height}`,
          /* And the same shape again as a bare number, for the rack. There
             the grid sets the height and works the width out itself, so it
             needs the ratio rather than the aspect: a cover is 4:5 and says
             nothing, a gallery frame is whatever it was shot at. Julian: a
             horizontal photograph stays horizontal in event coverage,
             automotive and places. */
          "--ar": (frame.width / frame.height).toFixed(4),
          "--i": i,
        } as React.CSSProperties
      }
    >
      <Image
        data-fade=""
        data-frame={frame.src}
        src={frame.src}
        alt={frame.alt || name}
        fill
        sizes={`(min-width: 640px) and (min-resolution: 2.5dppx) calc((100vh - 10rem) * ${((frame.width / frame.height) * 0.667).toFixed(3)}), (min-width: 640px) calc((100vh - 10rem) * ${(frame.width / frame.height).toFixed(3)}), 100vw`}
        loading="lazy"
        draggable={false}
        className="strip-frame object-cover"
      />
    </button>
  );
}
