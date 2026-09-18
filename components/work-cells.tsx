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
  cta = `All ${name.toLowerCase()}`,
}: {
  name: string;
  /** Already worded: "18 projects", "8 films". */
  count: string;
  href: string;
  hash: string;
  /** Its place in the strip, for the stagger of the arrival. */
  i: number;
  cta?: string;
}) {
  return (
    <div
      data-tick
      data-ring=""
      data-label={name}
      data-hash={hash}
      className="strip-cell flex w-full shrink-0 flex-col justify-center gap-4 py-10 sm:h-full sm:w-[min(22rem,50vw)] sm:py-0 sm:pl-10 sm:pr-4"
      style={{ "--i": i } as React.CSSProperties}
    >
      <h2 className="font-display text-3xl uppercase leading-[0.95] tracking-[0] sm:text-5xl">
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
 * ─────────────────────────────────────────────────────────────── */
export function FrameCell({
  frame,
  href,
  name,
  i,
}: {
  frame: Frame;
  href: string;
  /** The discipline, for the label a screen reader reads. */
  name: string;
  /** Its place in the strip, for the stagger of the arrival. */
  i: number;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      data-ring="View discipline"
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
        src={frame.src}
        alt={frame.alt || name}
        fill
        sizes={`(min-width: 640px) and (min-resolution: 2.5dppx) calc((100vh - 10rem) * ${((frame.width / frame.height) * 0.667).toFixed(3)}), (min-width: 640px) calc((100vh - 10rem) * ${(frame.width / frame.height).toFixed(3)}), 100vw`}
        loading="lazy"
        draggable={false}
        className="strip-frame object-cover"
      />
    </Link>
  );
}
