"use client";

import * as React from "react";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, TitleCell } from "@/components/strip-page";
import Link from "next/link";

/* ── the legal page ───────────────────────────────────────────────
 * Terms and Privacy on one page, side by side. It was a two column grid
 * that the page scrolled down; it runs sideways now, like the rest of the
 * site. Julian asked for the horizontal scroll here too.
 *
 * Which suits these two documents better than it suits anything else on
 * the site: they are read one at a time and never in sequence, so a
 * sideways page puts them beside each other at full measure instead of
 * making the reader pick a ribbon. Each document is one cell with its own
 * scroll, so a clause opening pushes nothing but itself, and the ruler
 * underneath has a stop for each: the page is its own table of contents.
 *
 * Each column is a title, the date it took effect, a short plain-language
 * opener, then numbered clauses. The numbering is real — it is how a
 * clause gets cited in an email — so it is rendered from a counter that
 * restarts per column rather than typed, and cannot drift when one is
 * inserted. "Terms clause 5" and "Privacy clause 5" are different things,
 * and each column's id lets them be linked as such.
 *
 * Set like the studio page, not like a contract in a PDF: measured prose,
 * the site's label for the eyebrows, and no smaller type than the rest of
 * the site uses. A policy nobody can read is a policy nobody has agreed
 * to.
 * ─────────────────────────────────────────────────────────────── */

export function LegalPage({ children }: { children: React.ReactNode }) {
  return (
    <StripPage
      head={
        <StripHead
          crumb={
            <Link
              prefetch={false}
              href="/"
              className="label text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
            >
              &larr; Home
            </Link>
          }
          title="Legal"
          live
          aside="Two documents"
        />
      }
    >
      <Strip
        label="Legal: the terms and the privacy policy, left and right"
        className="mt-4 flex-1"
      >
        {/* No opener. Julian: remove it. Two titles and two dates say what
            the page is, and a paragraph explaining that a legal page is a
            legal page is the kind of writing these documents are trying
            not to be. */}
        <TitleCell title="Legal" hash="legal">
          <p className="label text-muted-foreground">The small print</p>
        </TitleCell>
        {children}
      </Strip>
    </StripPage>
  );
}

export function LegalColumn({
  id,
  title,
  label,
  effective,
  intro,
  children,
}: {
  /** Anchor, so `/legal#terms` and `/legal#privacy` land on the column. */
  id: string;
  title: string;
  /** The short name, for the ruler under the strip and the running head:
      "Terms of Service" over an eight pixel tick is not a label. */
  label: string;
  /** ISO date, so the machine and the reader see the same day. */
  effective: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  const shown = new Date(`${effective}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return (
    <div
      data-tick
      data-label={label}
      data-hash={id}
      className="flex w-full shrink-0 flex-col py-8 sm:h-full sm:w-[min(38rem,86vw)] sm:py-0"
    >
      {/* The document scrolls inside its own column rather than taking the
          page with it: thirty one clauses are taller than any window, and
          the strip hands the wheel over to this box until it has run out
          (`data-scroll` in `strip.tsx`). It is also what keeps a clause
          opening from moving the other document. */}
      <div
        data-scroll
        className="flex min-h-0 flex-col overflow-y-auto overscroll-contain pr-3 sm:pb-8"
      >
        <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-28">
          <h2
            id={`${id}-title`}
            className="font-display text-3xl uppercase leading-none tracking-[0] sm:text-4xl"
          >
            {title}
          </h2>
          <p className="label mt-4 text-muted-foreground">
            Effective <time dateTime={effective}>{shown}</time>
          </p>

          <div className="mt-8 max-w-prose text-base leading-relaxed">
            {intro}
          </div>

          <ol className="mt-10 max-w-prose list-none border-t border-border p-0 [counter-reset:clause]">
            {/* Each clause takes an anchor of its own, named for the column
                it is in: "Changes" and "Contact" are the title of a clause
                in both columns, and `/legal#terms-changes` and
                `/legal#privacy-changes` are different clauses. Passed down
                rather than typed at each of the thirty-one call sites,
                which is thirty-one chances to repeat one. */}
            {React.Children.map(children, (child) =>
              React.isValidElement<{ column?: string }>(child)
                ? React.cloneElement(child, { column: id })
                : child,
            )}
          </ol>
        </section>
      </div>
    </div>
  );
}

/** A clause title as an anchor: "What you may do" becomes `what-you-may-do`. */
const anchor = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function Clause({
  title,
  column,
  children,
}: {
  title: string;
  /** Written by `LegalColumn`; the half of the page this clause is in. */
  column?: string;
  children: React.ReactNode;
}) {
  return (
    <li className="border-b border-border [counter-increment:clause]">
      {/* Julian: too text heavy. Thirty-one clauses set out in full is a
          wall nobody reads, and a policy nobody reads is a policy nobody
          has agreed to. Shut, the page is its table of contents and you
          open the one you came for.

          `<details>`, so it works with no JavaScript, is in the tab order
          and announced as expandable without a line of ARIA, and — the
          reason it has to be this element and not a state hook — a browser
          opens one by itself when the address names something inside it,
          which is what keeps `/legal#terms-ownership` landing on the
          clause rather than on a closed lid. */}
      <details
        id={column ? `${column}-${anchor(title)}` : undefined}
        className="group scroll-mt-28"
      >
        <summary className="label flex cursor-pointer list-none items-center gap-4 py-5 text-muted-foreground transition-colors duration-200 before:content-[counter(clause,decimal-leading-zero)] hoverable:hover:text-foreground [&::-webkit-details-marker]:hidden">
          <h3 className="min-w-0 flex-1">{title}</h3>
          {/* A cross that turns into a line: the shape says shut and open
              without a word, and turning is cheaper than swapping two
              glyphs. */}
          <span
            aria-hidden
            className="relative size-3 shrink-0 transition-transform duration-300 ease-[var(--ease-out-strong)] group-open:rotate-45 motion-reduce:transition-none"
          >
            <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
            <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current transition-opacity duration-200 group-open:opacity-0" />
          </span>
        </summary>
        <div className="space-y-4 pb-7 text-base leading-relaxed [&_li]:mt-2 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </details>
    </li>
  );
}
