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

/* ── the turn of a chapter ────────────────────────────────────────
 * A narrow cell at the end of a discipline that names the one coming. A
 * strip of a hundred and seventy cells reads as one long run without it;
 * this is the beat between two chapters, and it says where the wheel is
 * taking you before it gets there.
 *
 * The words are driven by the scroller rather than by a timer: they lie
 * back and off to one side while the cell is still out at the edge of the
 * window, and arrive as it reaches the middle. `animation-timeline: view()`
 * does that with no JavaScript and no observer — it is the scroll position
 * itself, so it runs backwards when you wheel back. Behind `@supports`, and
 * the resting state of the element is the arrived state, so a browser
 * without it simply shows the words.
 * ─────────────────────────────────────────────────────────────── */
export function UpNextCell({ name, i }: { name: string; i: number }) {
  return (
    <div
      aria-hidden
      data-ring=""
      className="strip-cell flex w-full shrink-0 flex-col justify-center gap-1.5 py-8 max-sm:py-4 sm:h-full sm:w-[min(13rem,45vw)] sm:items-end sm:py-0 sm:pl-8 sm:pr-8 sm:text-right"
      style={{ "--i": i } as React.CSSProperties}
    >
      {/* Quiet, and no count. The chapter head it runs into carries both
          the name set large and the count under it, and two of each on
          one screen read as the page saying it twice. This is a caption
          pointing forward, not a second title. */}
      <p className="up-next-eyebrow label text-muted-foreground/60">Up next</p>
      <p className="up-next-name font-display text-lg uppercase leading-none tracking-[0] text-muted-foreground">
        {name}
      </p>
      <p className="up-next-count label text-muted-foreground/60" aria-hidden>
        &rarr;
      </p>
    </div>
  );
}
