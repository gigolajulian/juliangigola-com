import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import type { Frame } from "@/lib/work-types";
import ACCENTS from "@/lib/accents.json";

/* ── the words between the covers ─────────────────────────────────
 * The work strip runs discipline by discipline, and each discipline opens
 * on its name: a cell of words before its run of covers, the way a chapter
 * opens on a title page. It carries the way to that discipline's own
 * page (the count under the name is gone, Julian asked), and it is what the chips at the top jump to.
 * ─────────────────────────────────────────────────────────────── */

export function GroupCell({
  name,
  href,
  hash,
  i,
  cta,
  alias,
}: {
  name: string;
  /** The word the cell stands under at the start of the strip, swapped for
      its own name once the strip moves (`data-moved`, `strip.tsx`). */
  alias?: string;
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
      // Opens a chapter of the deck (`lib/deck.ts`).
      data-deck
      data-ring=""
      data-label={name}
      data-name={name}
      data-hash={hash}
      className="strip-cell flex w-full shrink-0 flex-col justify-center gap-4 py-10 max-sm:gap-2.5 max-sm:py-5 sm:h-full sm:w-[min(22rem,50vw)] sm:py-0 sm:pl-10 sm:pr-4"
      style={{ "--i": i } as React.CSSProperties}
    >
      <h2
        style={{ "--n": Math.max(name.length, alias?.length ?? 0) } as React.CSSProperties}
        className="chapter-name font-display uppercase leading-[0.95] tracking-[0]"
      >
        {alias ? (
          <>
            <span className="chapter-alias" aria-hidden>
              {alias}
            </span>
            <span className="chapter-own">{name}</span>
          </>
        ) : (
          name
        )}
      </h2>
      {/* No "All projects" (Julian, 2026-10-07: not needed); the chips
          narrow the page. Only a cell given its own way on keeps one. */}
      {cta ? (
      <Link
        prefetch={false}
        href={href}
        // 44px tall to a thumb, the line drawn where it was.
        className="label w-fit border-b border-border pb-1 text-muted-foreground transition-colors duration-200 hoverable:hover:border-foreground hoverable:hover:text-foreground pointer-coarse:relative pointer-coarse:before:absolute pointer-coarse:before:-inset-x-2 pointer-coarse:before:-inset-y-2.5 pointer-coarse:before:content-['']"
      >
        {cta}
      </Link>
      ) : null}
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
  hash,
  credit,
}: {
  title: string;
  /** Who it was for, over the title on the slate. */
  credit?: string;
  /** The still, or nothing: a Vimeo film whose still was never looked
      up draws its own ground rather than a broken picture. */
  poster: string | null;
  href: string;
  /** Its place in the strip, for the stagger of the arrival. */
  i: number;
  eager?: boolean;
  /** Its deep link on the page, for the homepage's Commissions table. */
  hash?: string;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      data-tick
      data-hash={hash}
      data-name={title}
      /* Films have no samples to take a colour from, so the rail is given
         one that sits with the rest: a muted violet between Event
         coverage's indigo and Cover art's red (Julian, 2026-10-05). */
      data-tint="#7a5a9e"
      data-ring="Watch"
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
          alt={`Still from ${title}`}
          fill
          sizes="(min-width: 640px) calc((100vh - 10rem) * 1.778), 100vw"
          loading={eager ? "eager" : "lazy"}
          draggable={false}
          className="strip-frame object-cover"
          // A 16:9 still from the provider's CDN rather than a frame from
          // the archive. The loader sizes it to the slot like anything else.
        />
      ) : null}
      {/* The slate, as on the films page and every cover (`cover-cell.tsx`). */}
      <div className="cover-slate pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-start gap-[1.2cqw] bg-gradient-to-t from-black/80 via-black/35 to-transparent px-[5cqw] pb-[4.5cqw] pt-[16cqw]">
        {credit ? (
          <span className="label min-w-0 max-w-full truncate text-[clamp(0.625rem,1.6cqw,0.75rem)] leading-none text-white/75">
            {credit}
          </span>
        ) : null}
        <span
          style={{ "--n": title.length } as React.CSSProperties}
          className="cover-name font-display min-w-0 max-w-full truncate uppercase leading-[0.9] text-white"
        >
          {/* The last two words held together, so a title that wraps never
              leaves one alone (Julian, 2026-10-04: "Iranian Americans of /
              Silicon Valley"). */}
          {title.replace(/ (\S+)$/, "\u00a0$1")}
        </span>
      </div>
    </Link>
  );
}

export function FrameCell({
  frame,
  n,
  name,
  i,
  hash,
}: {
  frame: Frame;
  /** Its place in the page's own list of gallery frames: the strip reads
      it off the press and hands it to the viewer. */
  n: number;
  /** The discipline, for the label a screen reader reads. */
  name: string;
  /** Its place in the strip, for the stagger of the arrival. */
  i: number;
  /** Its deep link on the page, for the homepage's Commissions table. */
  hash?: string;
}) {
  return (
    <button
      type="button"
      data-n={n}
      data-hash={hash}
      /* Flies between the views and across the filters as a cover does
         (`morphView`), paired by the photograph itself: its place in the
         page's frames differs from one filter to the next. The list's
         line for it carries the same. Julian: Event coverage, Automotive
         and Places did not animate. */
      data-vt={frame.src}
      /* A stop on the ruler like any other cell. The galleries run out in
         full along the index - Julian asked for every frame of Event
         coverage, Automotive and Places - but only their opening title
         carried a tick, so the rail drew twenty two photographs as one
         segment and the discipline looked empty next to Editorial's
         thirty four. The frames take the name of the chapter they are
         under, which is what the rail already does with covers. */
      data-tick
      /* Its project's colour, for the rail (`scripts/make-accents.mjs`). */
      data-tint={(ACCENTS as Record<string, string>)[frame.src.split("/")[2]]}
      data-ring="Zoom"
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
