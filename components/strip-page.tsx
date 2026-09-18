import * as React from "react";
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
        /* The room the fixed bar needs, and not a pixel more. Measured:
           the bar is 77px on a tablet and 69 on a phone at the old
           padding, 61 and 57 at the new, so the reserve comes down with
           it. Every pixel here is a pixel off the photographs. */
        head && "pt-20 sm:pt-20 max-sm:pt-16 tablet:pt-16 lying:pt-12",
        className,
      )}
    >
      {head}
      {children}
    </article>
  );
}

/** A title whose words rise into place from under a clip, one after
    another (`title-word` in `globals.css`). The clip is on the word, not
    the line, so the words can wrap. */
export function RisingTitle({
  text,
  className,
  decorative = false,
}: {
  text: string;
  className?: string;
  /** The same words the running head already carries as the page's `h1`:
      set large here for the eye, hidden from a screen reader so the page
      is not announced twice. */
  decorative?: boolean;
}) {
  return (
    <h2
      aria-hidden={decorative || undefined}
      className={cn(
        "font-display text-4xl uppercase leading-[0.95] tracking-[0] sm:text-6xl",
        className,
      )}
    >
      {text.split(" ").map((word, i) => (
        <React.Fragment key={i}>
          <span className="inline-block overflow-hidden align-top">
            <span
              className="title-word inline-block"
              style={{ "--i": i } as React.CSSProperties}
            >
              {word}
            </span>
          </span>{" "}
        </React.Fragment>
      ))}
    </h2>
  );
}

/** The opening cell of a page's strip: the title set large, with a line or
    two under it that fade up after. The running head in the page's head
    waits for this cell to go, so the same words are never on screen
    twice. */
export function TitleCell({
  title,
  hash,
  children,
  className,
}: {
  title: string;
  hash?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-hash={hash}
      className={cn(
        "flex w-full shrink-0 flex-col justify-center gap-4 py-6 sm:gap-5 sm:h-full sm:w-[min(30rem,82vw)] sm:py-0 sm:pr-6",
        className,
      )}
    >
      <RisingTitle text={title} decorative />
      {children ? (
        <div className="title-rest flex flex-col gap-4">{children}</div>
      ) : null}
    </div>
  );
}

/** Three columns, the outer two the same width, so the title is centred on
    the page and not on whatever is left over. The middle is the running
    head, and it waits its turn: the sequence opens on the title set large,
    so this would be the same words twice on the first screen. `running-head`
    fades it in once that cell has been scrolled past — the rule is in
    `globals.css`, keyed off an attribute the strip sets.

    `open` is for a strip that has no title cell of its own: the title is
    the page's, it is here from the start, and it rises into place when the
    page arrives and again whenever the word changes. */
export function StripHead({
  crumb,
  title,
  sub,
  live,
  aside,
  open = false,
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
  /** The title is the page's own, shown from the first frame rather than
      after the opening cell has gone. */
  open?: boolean;
}) {
  return (
    <header className="mx-auto w-full max-w-[100rem] shrink-0 px-6 sm:px-10 lying:px-6">
      <div className="flex items-start justify-between gap-6">
        <div className="w-28 shrink-0 sm:w-44">{crumb}</div>

        <div className={cn("min-w-0 text-center", !open && "running-head")}>
          {/* Set in the display face at a size that reads as a title and
              not a caption. Julian asked for the top title bigger and in
              the display face, with the client or model under it.

              An open head reveals: each word rises out from under a clip,
              one after the other, the same move a title cell makes, so the
              page still opens on its title arriving — it arrives here
              instead of in the first cell. Keyed on the word, so a head
              whose title changes under it plays the reveal again rather
              than swapping the word in place. */}
          <h1
            key={open ? title : undefined}
            className="font-display line-clamp-2 text-xl uppercase leading-none tracking-[0] sm:line-clamp-none sm:text-3xl lying:text-xl"
          >
            {open
              ? title.split(" ").map((word, i) => (
                  <React.Fragment key={i}>
                    <span className="inline-block overflow-hidden align-top">
                      <span
                        className="title-word inline-block"
                        style={{ "--i": i } as React.CSSProperties}
                      >
                        {word}
                      </span>
                    </span>{" "}
                  </React.Fragment>
                ))
              : title}
          </h1>
          {sub ? (
            <p className="label mt-1.5 text-muted-foreground">{sub}</p>
          ) : live ? (
            <p
              data-strip-at
              className="label mt-1.5 min-h-[1lh] text-muted-foreground"
            />
          ) : null}
        </div>

        {/* On a phone the head is the way back and the name of the page,
            and nothing else: 112px of column broke `4 session types` over
            two lines against the right edge, and every count here is said
            again by the cell the sequence opens on. */}
        <p className="label w-28 shrink-0 text-right text-muted-foreground sm:w-44">
          <span className="max-sm:hidden">{aside}</span>
        </p>
      </div>
    </header>
  );
}
