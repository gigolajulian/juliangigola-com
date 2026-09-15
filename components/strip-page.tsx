import { cn } from "@/lib/utils";

/* ── the one-screen page ──────────────────────────────────────────
 * The chrome around a strip: an article that is exactly the window with
 * the footer's one line on it, and the head over the sequence. The strip
 * itself is `strip.tsx`; this is what every horizontal page wraps it in so
 * they all sit on the screen the same way.
 *
 * `data-quiet-footer` does two jobs, both in `globals.css`: the site
 * footer under this page is the one line of housekeeping rather than the
 * ask every other page ends on (the ask is a cell of the strip now), and
 * from 40rem up the page is exactly the window with that line on it. The
 * children are sized to fit inside: the head and the strip's panel take
 * what they need and the strip takes the rest, so the pictures are as
 * tall as the window allows on every screen without a single height being
 * written down.
 * ─────────────────────────────────────────────────────────────── */

export function StripPage({
  head,
  className,
  children,
}: {
  /** Usually a `StripHead`. Without one the strip starts at the top of the
      window, which is how the homepage's cover wants it. */
  head?: React.ReactNode;
  /** `h-dvh` for a strip that stays sideways on a phone; nothing for one
      that stacks there and scrolls as a page. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      data-quiet-footer
      className={cn(
        "flex min-h-0 flex-col sm:h-full",
        head && "pt-24 sm:pt-28",
        className,
      )}
    >
      {head}
      {children}
    </article>
  );
}

/** Three columns, the outer two the same width, so the title is centred on
    the page and not on whatever is left over. The middle is the running
    head, and it waits its turn: the sequence opens on the title set large,
    so this would be the same words twice on the first screen. `running-head`
    fades it in once that cell has been scrolled past — the rule is in
    `globals.css`, keyed off an attribute the strip sets. */
export function StripHead({
  crumb,
  title,
  sub,
  live,
  aside,
}: {
  crumb: React.ReactNode;
  title: string;
  /** A line under the title: who the work was for, or who is in it. */
  sub?: React.ReactNode;
  /** A line under the title that the strip writes the current cell's word
      into as the sequence moves, so the head says where you are. */
  live?: boolean;
  /** What it is and how much of it there is, opposite the crumb. */
  aside?: React.ReactNode;
}) {
  return (
    <header className="mx-auto w-full max-w-[100rem] shrink-0 px-6 sm:px-10">
      <div className="flex items-start justify-between gap-6">
        <div className="w-28 shrink-0 sm:w-44">{crumb}</div>

        <div className="running-head min-w-0 text-center">
          {/* Set in the display face at a size that reads as a title and
              not a caption. Julian asked for the top title bigger and in
              the display face, with the client or model under it. */}
          <h1 className="font-display line-clamp-2 text-xl uppercase leading-none tracking-[0] sm:line-clamp-none sm:text-3xl">
            {title}
          </h1>
          {sub ? (
            <p className="label mt-1.5 text-muted-foreground">{sub}</p>
          ) : live ? (
            <p data-strip-at className="label mt-1.5 min-h-[1em] text-muted-foreground" />
          ) : null}
        </div>

        <p className="label w-28 shrink-0 text-right text-muted-foreground sm:w-44">
          {aside}
        </p>
      </div>
    </header>
  );
}
