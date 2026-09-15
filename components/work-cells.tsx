import Link from "next/link";

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
  cta = `See all ${name.toLowerCase()}`,
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
