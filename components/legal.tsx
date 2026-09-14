import type * as React from "react";

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
    <div className="pb-24 pt-28 sm:pt-36">
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

      <ol className="mt-14 max-w-prose list-none space-y-12 p-0 [counter-reset:clause]">
        {children}
      </ol>
    </section>
  );
}

export function Clause({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="[counter-increment:clause]">
      <h3 className="label flex gap-4 text-muted-foreground before:content-[counter(clause,decimal-leading-zero)]">
        {title}
      </h3>
      <div className="mt-5 space-y-4 text-base leading-relaxed [&_li]:mt-2 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </li>
  );
}
