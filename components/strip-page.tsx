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
  as = "h2",
}: {
  text: string;
  className?: string;
  /** The same words the running head already carries as the page's `h1`:
      set large here for the eye, hidden from a screen reader so the page
      is not announced twice. */
  decorative?: boolean;
  /** `h1` where the title is the page's own heading: the booking pages,
      which have no running head to carry it. */
  as?: "h1" | "h2";
}) {
  const Tag = as;
  return (
    <Tag
      aria-hidden={decorative || undefined}
      className={cn(
        "font-display text-4xl uppercase leading-[0.95] tracking-[0] sm:text-6xl",
        className,
      )}
      style={{ "--word-em": longestWord(text) } as React.CSSProperties}
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
    </Tag>
  );
}

/** The longest word's width in ems, in the display face's capitals: about
    0.72 of an em a letter (AUTOMOTIVE measured 7.08), up to 0.754 in wide
    letters (UKIYOSUNKNOWN), so 0.76 to be safe. The large discipline and
    project titles are held to their cell with it (`globals.css`). */
export const longestWord = (text: string) =>
  Math.max(...text.split(" ").map((w) => w.length)) * 0.76;

/** The whole title's width in ems, on one line: the same 0.76 a letter and
    about 0.3 a space. A project's title is held to one line with it. */
export const titleWidth = (text: string) =>
  text.replace(/ /g, "").length * 0.76 + (text.split(" ").length - 1) * 0.3;

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
      // The whole title's width, for the spine (`globals.css`).
      style={{ "--title-em": titleWidth(title) } as React.CSSProperties}
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

/** Three columns, the outer two the same width from `sm` up, so the title
    is centred on the page and not on whatever is left over. On a phone the
    rails are their content's width: at 112px each, with the gaps and the
    page padding, a title at 360px wide had 40px and DIESEL: FOR SUCCESSFUL
    LIVING came out as "DIES / FO…". The title sits a little right of the
    page's centre there instead, and the longest name still clamps below
    about 357px. The middle is the running
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
  phone,
  open = false,
  pick,
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
  /** What stands in for `aside` on a phone, where it is hidden. */
  phone?: React.ReactNode;
  /** The title is the page's own, shown from the first frame rather than
      after the opening cell has gone. */
  open?: boolean;
  /** On a phone the title is also the way to the other filters (Julian,
      2026-10-04: the drop-down beside the title, not a box under it). */
  pick?: { count?: number; expanded: boolean; controls: string; onPick: () => void };
}) {
  const words = open
    ? title.split(" ").map((word, i) => (
        <React.Fragment key={i}>
          <span className="inline-block overflow-hidden align-top">
            <span className="title-word inline-block" style={{ "--i": i } as React.CSSProperties}>
              {word}
            </span>
          </span>{" "}
        </React.Fragment>
      ))
    : title;
  return (
    <header className="page-column mx-auto w-full max-w-[100rem] shrink-0 px-6 sm:px-10 lying:px-6">
      {/* Julian: centre the title on a phone. Its right column is empty
          there, so between a crumb and nothing the title sat centred in
          what was left, right of the page's middle. Two equal outer tracks
          put it on the middle; a crumb or a title too long for that still
          gets the room it needs, because a track never goes below its
          words. */}
      <div
        className={cn(
          "flex items-start justify-between gap-6 max-sm:grid",
          /* Where the title is the filter: the title centred, the views
             stacked at the right under the burger (Julian, 2026-10-04). */
          // Top, not centre: the title's column carries the line under it.
          pick ? "max-sm:items-start max-sm:gap-x-3" : "",
          "max-sm:grid-cols-[1fr_auto_1fr]",
        )}
      >
        {/* Where the title is the filter, the way back is in it ("All"), and
            the crumb beside it only squeezed it onto two lines. */}
        <div data-dial="crumb" className={cn("shrink-0 sm:w-44", pick && "max-sm:[&>*]:hidden")}>{crumb}</div>

        <div data-dial="page-title" className={cn("min-w-0 text-center", !open && "running-head")}>
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
            className={cn(
              "font-[family-name:var(--font-wordmark)] font-black line-clamp-2 text-xl uppercase leading-none tracking-[0] sm:line-clamp-none sm:text-3xl lying:text-xl",
              /* The clamp hides overflow, and with it the button's reach past
                 its 20px: taps a few pixels off it missed (audit,
                 2026-10-05). It is one line there anyway. */
              pick && "max-sm:line-clamp-none",
            )}
          >
            {pick ? (
              <>
                <span className="max-sm:hidden">{words}</span>
                <button
                  type="button"
                  aria-expanded={pick.expanded}
                  aria-controls={pick.controls}
                  onClick={pick.onPick}
                  className="relative z-10 inline-flex items-center gap-1.5 whitespace-nowrap press active:scale-[0.97] before:absolute before:-inset-x-3 before:-inset-y-3 before:content-[''] sm:hidden"
                >
                  <span>{words}</span>
                  {pick.count !== undefined ? (
                    <span className="label self-start text-[0.625rem] tabular-nums leading-none text-muted-foreground">
                      {pick.count}
                    </span>
                  ) : null}
                  <svg
                    aria-hidden
                    width="10"
                    height="7"
                    viewBox="0 0 9 6"
                    className={cn(
                      "text-muted-foreground transition-transform duration-300 ease-[var(--ease-out-strong)]",
                      pick.expanded && "rotate-180",
                    )}
                  >
                    <path d="M1 1l3.5 3.5L8 1" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                </button>
              </>
            ) : (
              words
            )}
          </h1>
          {sub ? (
            /* Julian: always centred. The head's `text-center` lost to
               the justified paragraphs (`globals.css`), which set a line
               this short flush left on a laptop. */
            <p className="label mt-1.5 text-center text-muted-foreground">{sub}</p>
          ) : live !== undefined ? (
            /* `live={false}` keeps the line's room and leaves it empty, so
               a head that switches it off does not move the strip. Keyed,
               because the strip writes this line by hand: the head stays
               up across a filter click, so without a new element the last
               word written on All work stayed under the filter's title
               (COVER ART over EVENT COVERAGE). */
            <p
              key={live ? "live" : "still"}
              data-strip-at={live ? "" : undefined}
              className="label mt-1.5 min-h-[1lh] text-center text-muted-foreground"
            />
          ) : null}
        </div>

        {/* On a phone the head is the way back and the name of the page,
            and nothing else: 112px of column broke `4 session types` over
            two lines against the right edge, and every count here is said
            again by the cell the sequence opens on. */}
        {/* A client's logo, where a campaign has one, sits level with the
            middle of the title block rather than on the crumb's line. */}
        <div className={cn("label shrink-0 text-right text-muted-foreground has-[[data-aside-mark]]:self-center sm:w-44", pick && "max-sm:justify-self-end")}>
          <span className="max-sm:hidden">{aside}</span>
          {phone ? <span className="sm:hidden">{phone}</span> : null}
        </div>
      </div>
    </header>
  );
}
