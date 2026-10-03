import type * as React from "react";
import Link from "next/link";
import type { Lead } from "@/components/strip";
import { cn } from "@/lib/utils";
import { LiquidPair } from "@/components/liquid-pair";

/* ── the ask, as the last cell ────────────────────────────────────
 * Every strip ends on this. The site is judged on enquiries, and the old
 * site's one route to booking was a nav dropdown; on a page that runs
 * sideways the end of the sequence is the moment of peak interest, and
 * this is what is there. `type` carries through so the form opens on the
 * right branch with the right follow-up question already asked, exactly
 * as `call-to-action.tsx` does for the pages that still scroll down.
 *
 * Under the ask, where the sequence goes next, so a wheel that keeps
 * turning has somewhere to go and the visitor can see it coming.
 * ─────────────────────────────────────────────────────────────── */

export function EnquiryCell({
  title,
  body,
  type = "other",
  detail,
  secondary,
  aside,
  backdrop,
  next,
  tick = true,
  className,
}: {
  title: string;
  /** A stop on the strip's ruler. Off for the work index, where Julian
      did not want the ask counted as a thirteenth chapter of the work;
      the cell is still there and still the end of the strip. */
  tick?: boolean;
  body?: string;
  /** Pre-selects the contact form's branch. */
  type?: string;
  /** Extra context for the follow-up field, e.g. the project just viewed. */
  detail?: string;
  secondary?: { href: string; label: string };
  /** Anything that belongs beside the ask rather than after it: the
      homepage puts its two doors here, because the ask and "where next"
      were two screens asking the same thing with a window of paper
      between them. Given half the cell from sm up. */
  aside?: React.ReactNode;
  /** Something behind the whole cell, under the ask and the aside: the
      homepage's wall of the work. */
  backdrop?: React.ReactNode;
  /** The page a wheel past this cell leads to; named here so it is no
      surprise when it arrives. */
  next?: Lead;
  className?: string;
}) {
  const href = detail
    ? `/?type=${encodeURIComponent(type)}&ref=${encodeURIComponent(detail)}#contact`
    : `/?type=${encodeURIComponent(type)}#contact`;

  return (
    <div
      data-tick={tick ? "" : undefined}
      data-ring=""
      data-label={tick ? "Inquire" : undefined}
      data-hash="where-next"
      className={cn(
        "relative flex w-full shrink-0 flex-col justify-center gap-6 py-10 sm:h-full sm:w-[min(40rem,85vw)] sm:py-0 sm:pl-24 sm:pr-6",
        /* With an aside the cell is the whole window, split: the ask
           centred in the left half with room around it, and the aside
           given the right half floor to ceiling. Stretched and not
           centred, or at 2000px the aside floats in the middle of the
           screen as a box with the ask marooned beside it. The cell's own
           padding goes, so each half sets its own. */
        /* On a phone the doors run to the cell's foot, so the wall never
           shows under the last one without its tint. */
        aside &&
          "gap-0 max-sm:pb-0 sm:grid sm:w-[100vw] sm:grid-cols-2 sm:items-stretch sm:p-0",
        className,
      )}
    >
      {backdrop ? (
        <div className="enquiry-backdrop absolute inset-0 overflow-hidden">
          {backdrop}
        </div>
      ) : null}
      {/* The ask itself, as one column. Its own flex box rather than the
          cell's, so an aside can sit beside the whole of it. */}
      <div
        className={cn(
          "relative flex flex-col gap-6",
          /* Centred under the bar (`--bar-h`), as the doors beside it are. */
          aside && "justify-center px-6 py-12 sm:px-10 sm:pb-0 sm:pt-[var(--bar-h)] lying:gap-4 lying:px-10 lying:pt-12",
        )}
      >
        <div>
          {/* Julian: matched with Contact's "Get in Touch" (RisingTitle's
              size: 2.25rem, 3.75rem from sm) and its 40px in. */}
          <h2 className="title max-w-[22ch] leading-[0.95] [--text-title:2.25rem] sm:[--text-title:min(3.75rem,6vw)] lying:[--text-title:2.25rem]">{title}</h2>
          {body ? (
            <p className="mt-4 max-w-prose text-sm normal-case leading-relaxed text-muted-foreground [zoom:1.02] lying:mt-2">
              {body}
            </p>
          ) : null}
        </div>

        <LiquidPair className="flex flex-wrap items-center gap-3">
          <Link
            href={href}
            className="label action px-6 py-4 press active:scale-[0.97]"
          >
            Inquire
          </Link>
          {secondary ? (
            <Link
              prefetch={false}
              href={secondary.href}
              className="label action-quiet px-6 py-4 press active:scale-[0.97]"
            >
              {secondary.label}
            </Link>
          ) : null}
        </LiquidPair>

        <a
          href="mailto:hello@juliangigola.com"
          data-ring="Email"
          /* Padded to a 29px target and pulled back by as much, so the
             line sits where it did (UI/UX review: it was 13px tall). */
          className="label -my-2 w-fit py-2 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
        >
          hello@juliangigola.com
        </a>
        {next ? (
          <Link
            prefetch={false}
            href={next.href}
            data-ring="Next"
            /* Full ink on a phone: in the dark, over the wall's lighter
               photographs the muted grey measured 3.3:1 (UI/UX review). */
            className="label mt-4 w-fit border-t border-border pt-4 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground max-sm:text-foreground lying:hidden"
          >
            Next: {next.name}
          </Link>
        ) : null}
      </div>

      {backdrop && aside ? <div className="relative h-full">{aside}</div> : aside}
    </div>
  );
}
