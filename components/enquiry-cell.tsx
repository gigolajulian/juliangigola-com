import Link from "next/link";
import type { Lead } from "@/components/strip";
import { cn } from "@/lib/utils";

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
  next,
  className,
}: {
  title: string;
  body?: string;
  /** Pre-selects the contact form's branch. */
  type?: string;
  /** Extra context for the follow-up field, e.g. the project just viewed. */
  detail?: string;
  secondary?: { href: string; label: string };
  /** The page a wheel past this cell leads to; named here so it is no
      surprise when it arrives. */
  next?: Lead;
  className?: string;
}) {
  const href = detail
    ? `/contact?type=${encodeURIComponent(type)}&ref=${encodeURIComponent(detail)}`
    : `/contact?type=${encodeURIComponent(type)}`;

  return (
    <div
      data-tick
      data-ring=""
      data-label="Enquire"
      data-hash="enquire"
      className={cn(
        "flex w-full shrink-0 flex-col justify-center gap-6 py-10 sm:h-full sm:w-[min(40rem,85vw)] sm:py-0 sm:pl-24 sm:pr-6",
        className,
      )}
    >
      <div>
        <h2 className="title max-w-[22ch]">{title}</h2>
        {body ? (
          <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={href}
          className="label action rounded-full px-6 py-4 press active:scale-[0.97]"
        >
          Enquire
        </Link>
        {secondary ? (
          <Link
            prefetch={false}
            href={secondary.href}
            className="label action-quiet rounded-full px-6 py-4 press active:scale-[0.97]"
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>

      <a
        href="mailto:hello@juliangigola.com"
        className="label w-fit text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
      >
        hello@juliangigola.com
      </a>

      {next ? (
        <Link
          prefetch={false}
          href={next.href}
          data-ring="Next"
          className="label mt-4 w-fit border-t border-border pt-4 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
        >
          Next: {next.name}
        </Link>
      ) : null}
    </div>
  );
}
