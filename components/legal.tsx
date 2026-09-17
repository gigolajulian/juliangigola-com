import * as React from "react";

/* ── the legal page ───────────────────────────────────────────────
 * Terms and Privacy on one page, side by side: two columns from `xl` up,
 * a stack below it. Each column is a title, the date it took effect, a
 * short plain-language opener, then numbered clauses. The numbering is
 * real — it is how a clause gets cited in an email — so it is rendered
 * from a counter that restarts per column rather than typed, and cannot
 * drift when one is inserted. "Terms clause 5" and "Privacy clause 5" are
 * different things, and each column's id lets them be linked as such.
 *
 * Set like the studio page, not like a contract in a PDF: two measured
 * prose columns, the site's label for the eyebrows, and no smaller type
 * than the rest of the site uses. A policy nobody can read is a policy
 * nobody has agreed to.
 * ─────────────────────────────────────────────────────────────── */

export function LegalPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-24 pt-24 sm:pt-28">
      <div className="mx-auto max-w-[100rem] px-6 sm:px-10">
        <p className="label text-muted-foreground">The small print</p>
        <h1 className="mt-4 max-w-[20ch] title">Legal</h1>
        <p className="mt-6 max-w-prose text-base leading-relaxed text-muted-foreground">
          Two documents, one page. The terms say what you may do with the work
          on this site, and that none of it is training data. The privacy policy
          says what the site knows about you, which is very little.
        </p>

        {/* Two columns from `xl`: below that, two long documents beside each
            other would be two narrow ribbons of legal text, which is the
            least readable thing a page can be. The gap is wide so the eye
            does not slide from one document's clause into the other's. */}
        <div className="mt-16 grid gap-20 lg:mt-24 xl:grid-cols-2 xl:gap-x-24">
          {children}
        </div>
      </div>
    </div>
  );
}

export function LegalColumn({
  id,
  title,
  effective,
  intro,
  children,
}: {
  /** Anchor, so `/legal#terms` and `/legal#privacy` land on the column. */
  id: string;
  title: string;
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

      <div className="mt-10 max-w-prose text-base leading-relaxed">{intro}</div>

      <ol className="mt-14 max-w-prose list-none border-t border-border p-0 [counter-reset:clause]">
        {/* Each clause takes an anchor of its own, named for the column it
            is in: "Changes" and "Contact" are the title of a clause in both
            columns, and `/legal#terms-changes` and `/legal#privacy-changes`
            are different clauses. Passed down rather than typed at each of
            the thirty-one call sites, which is thirty-one chances to repeat
            one. */}
        {React.Children.map(children, (child) =>
          React.isValidElement<{ column?: string }>(child)
            ? React.cloneElement(child, { column: id })
            : child,
        )}
      </ol>
    </section>
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
