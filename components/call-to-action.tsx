import * as React from "react";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { cn } from "@/lib/utils";

/* ── the ask ──────────────────────────────────────────────────────
 * One CTA component, used at the end of every page that a visitor can
 * reasonably finish.
 *
 * The old site had exactly one route to booking — a "CONTACT" item in a nav
 * dropdown — which meant the moment of peak interest (having just looked
 * through eighteen frames of a campaign) led nowhere but a footer. Every
 * gallery, index, and session now ends with a specific ask rather than a
 * generic one, and `type` carries through so the form opens on the right
 * branch with the right follow-up question already asked.
 * ─────────────────────────────────────────────────────────────── */

export function CallToAction({
  title,
  body,
  /** Pre-selects the contact form's branch. */
  type = "other",
  /** Extra context for the follow-up field, e.g. the project just viewed. */
  detail,
  secondary,
  className,
}: {
  title: string;
  body?: string;
  type?: string;
  detail?: string;
  secondary?: { href: string; label: string };
  className?: string;
}) {
  const titleId = React.useId();
  const href = detail
    ? `/contact?type=${encodeURIComponent(type)}&ref=${encodeURIComponent(detail)}`
    : `/contact?type=${encodeURIComponent(type)}`;

  return (
    <section
      className={cn("border-t border-border", className)}
      aria-labelledby={titleId}
    >
      {/* One reveal for the whole ask. It is the last thing before the
          footer on four different routes, and it earns its arrival — but the
          title, the body and the two buttons are one sentence, not four
          things, so they come in together. */}
      <Reveal
        variant="calm"
        className="mx-auto flex max-w-[100rem] flex-col gap-8 px-6 py-16 sm:flex-row sm:items-end sm:justify-between sm:px-10 sm:py-20"
      >
        <div>
          <h2 id={titleId} className="title max-w-[22ch]">
            {title}
          </h2>
          {body ? (
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <Link
            href={href}
            className="label action rounded-full px-6 py-4 press active:scale-[0.97]"
          >
            Enquire
          </Link>
          {secondary ? (
            <Link
              href={secondary.href}
              className="label action-quiet rounded-full px-6 py-4 press active:scale-[0.97]"
            >
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </Reveal>
    </section>
  );
}
