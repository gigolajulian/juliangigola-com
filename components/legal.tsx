import type * as React from "react";

/* ── the legal pages ──────────────────────────────────────────────
 * Terms and Privacy share one shape: a title, the date they took effect, a
 * short plain-language opener, then numbered clauses. The numbering is
 * real — it is how a clause gets cited in an email — so it is rendered from
 * a counter rather than typed, and cannot drift when one is inserted.
 *
 * Set like the studio page, not like a contract in a PDF: a measured prose
 * column, the site's label for the eyebrows, and no smaller type than the
 * rest of the site uses. A policy nobody can read is a policy nobody has
 * agreed to.
 * ─────────────────────────────────────────────────────────────── */

export function LegalPage({
  eyebrow,
  title,
  effective,
  intro,
  children,
}: {
  eyebrow: string;
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
    <div className="pb-24 pt-28 sm:pt-36">
      <div className="mx-auto max-w-[100rem] px-6 sm:px-10">
        <p className="label text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-4 max-w-[20ch] title">{title}</h1>
        <p className="label mt-6 text-muted-foreground">
          Effective <time dateTime={effective}>{shown}</time>
        </p>

        <div className="mt-12 max-w-prose text-base leading-relaxed lg:mt-16">
          {intro}
        </div>

        <ol className="mt-16 max-w-prose list-none space-y-14 p-0 [counter-reset:clause]">
          {children}
        </ol>
      </div>
    </div>
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
      <h2 className="label flex gap-4 text-muted-foreground before:content-[counter(clause,decimal-leading-zero)]">
        {title}
      </h2>
      <div className="mt-6 space-y-4 text-base leading-relaxed [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </li>
  );
}
