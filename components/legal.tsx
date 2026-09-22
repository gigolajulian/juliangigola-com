"use client";

import * as React from "react";
import Link from "next/link";
import { Strip } from "@/components/strip";
import { StripPage, StripHead } from "@/components/strip-page";
import { cn } from "@/lib/utils";

/* ── the legal page ───────────────────────────────────────────────
 * Two pages, and that is the whole of it. Each is one document laid out
 * in three columns: the instrument's title and preamble at the left, the
 * clauses numbered down the middle in a single column, and the clause
 * itself set in the reading column on the right. The reading column
 * follows the pointer and holds whatever was last pressed, so a clause
 * can be skimmed by running down the list and kept by pressing it.
 *
 * This is the fourth shape, and the reasons the others went: a sideways
 * two column grid was two documents scrolling inside themselves; a panel
 * per clause read its titles sideways, then upright, and ran to six
 * thousand pixels of spine; a modal dialog covered the document it came
 * out of. A contents list against a reading pane is what a bound
 * instrument does, and it is the only one of the four where the clause
 * and its place in the document are visible at the same time.
 *
 * The numbering is real, because it is how a clause gets cited in an
 * email, and every clause keeps its anchor: `/legal#terms-ownership`
 * opens that clause on arrival and the address follows what is selected,
 * so a clause can be sent to somebody.
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
        {children}
      </Strip>
    </StripPage>
  );
}

/** A clause title as an anchor: "What you may do" becomes `what-you-may-do`. */
const anchor = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function LegalColumn({
  id,
  title,
  label,
  effective,
  intro,
  children,
}: {
  /** Anchor, so `/legal#terms` and `/legal#privacy` land on the page. */
  id: string;
  title: string;
  /** The short name, for the ruler under the strip. */
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

  /* The clauses are read off the children rather than rendered by them.
     A `Clause` is a declaration, not a component: the list and the
     reading column are two views of the same clause, and one of them
     cannot be drawn from inside the other. */
  const clauses = React.useMemo(
    () =>
      React.Children.toArray(children)
        .filter(
          (c): c is React.ReactElement<{ title: string; children: React.ReactNode }> =>
            React.isValidElement(c),
        )
        .map((c, i) => ({
          n: i + 1,
          title: c.props.title,
          body: c.props.children,
          id: `${id}-${anchor(c.props.title)}`,
        })),
    [children, id],
  );

  const [pick, setPick] = React.useState(0);
  const [peek, setPeek] = React.useState<number | null>(null);
  const at = clauses[peek ?? pick] ?? clauses[0];

  /* An address that names a clause of this document selects it, on
     arrival and on every later hashchange. The strip writes its own
     section hash over the top a moment after a press, which names no
     clause and is ignored. */
  React.useEffect(() => {
    const read = () => {
      const want = decodeURIComponent(window.location.hash.slice(1));
      const i = clauses.findIndex((c) => c.id === want);
      if (i < 0) return;
      setPick(i);
      /* The strip travels to a cell whose hash it knows, and a clause is
         not one of those: `#privacy-your-rights` names a line in the
         contents, not a page. So the document brings itself into view. */
      document.getElementById(id)?.scrollIntoView({ inline: "start", block: "nearest" });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [clauses, id]);

  const press = (i: number) => {
    setPick(i);
    window.history.replaceState(null, "", `#${clauses[i].id}`);
  };

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-tick
      data-label={label}
      data-hash={id}
      /* One document, one screen. Julian: two pages total, so the second
         document is one gesture away rather than eleven. */
      className="flex w-full shrink-0 flex-col gap-8 py-8 sm:h-full sm:w-full sm:flex-row sm:items-stretch sm:gap-10 sm:py-2 sm:pr-10"
    >
      <div className="flex shrink-0 flex-col justify-center gap-5 sm:w-[min(16rem,24%)]">
        <div>
          <h2
            id={`${id}-title`}
            className="font-display text-3xl uppercase leading-none tracking-[0] sm:text-4xl"
          >
            {title}
          </h2>
          <p className="label mt-3 text-muted-foreground">
            Effective <time dateTime={effective}>{shown}</time>
          </p>
        </div>
        <div className="max-w-prose text-[0.9375rem] leading-relaxed">
          {intro}
        </div>
        <p className="label text-muted-foreground">
          {clauses.length} clauses
        </p>
      </div>

      {/* The contents. One column, as Julian asked, and it scrolls inside
          itself on a short window rather than pushing the reading column
          off the page. */}
      <ol
        className="m-0 min-w-0 list-none p-0 sm:h-full sm:w-[min(26rem,36%)] sm:shrink-0 sm:overflow-y-auto sm:overscroll-contain sm:pr-3"
        onMouseLeave={() => setPeek(null)}
      >
        {clauses.map((c, i) => (
          <li key={c.id} className="border-b border-border last:border-b-0">
            <button
              id={`${c.id}-open`}
              type="button"
              onClick={() => press(i)}
              onMouseEnter={() => setPeek(i)}
              onFocus={() => setPeek(i)}
              onBlur={() => setPeek(null)}
              aria-current={pick === i ? "true" : undefined}
              className={cn(
                /* Julian: make the sections bigger. The row is set a step
                   above the label face and given the height of a line in
                   a table of contents, which is what it is. Twenty one of
                   them no longer fit a short window, so the column
                   scrolls; the reading column beside it does not move. */
                "label flex w-full items-center gap-4 py-1.5 text-left text-sm leading-tight tracking-[0.06em] transition-colors duration-200",
                at?.id === c.id ? "text-foreground" : "text-muted-foreground",
                "hoverable:hover:text-foreground",
              )}
            >
              <span className="tabular-nums">{String(c.n).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1">{c.title}</span>
              {/* A rule that fills when the clause is the one being read:
                  the list's own marker, in the width a number would take. */}
              <span
                aria-hidden
                className={cn(
                  "h-px w-4 shrink-0 transition-colors duration-200",
                  at?.id === c.id ? "bg-foreground" : "bg-transparent",
                )}
              />
            </button>
          </li>
        ))}
      </ol>

      {/* The reading column. `aria-live` is deliberately absent: the text
          changes under the pointer, and announcing every clause somebody
          skims past is noise. The buttons name themselves. */}
      <article
        aria-labelledby={`${id}-reading`}
        className="min-w-0 flex-1 border-t border-border pt-5 sm:h-full sm:overflow-y-auto sm:overscroll-contain sm:border-l sm:border-t-0 sm:pl-10 sm:pt-0"
      >
        <h3 id={`${id}-reading`} className="label text-muted-foreground">
          <span className="tabular-nums">{String(at?.n ?? 1).padStart(2, "0")}</span>
          <span className="ml-4 text-foreground">{at?.title}</span>
        </h3>
        <div className="mt-5 max-w-[38rem] text-base leading-relaxed [&_li]:mt-2 [&_p+p]:mt-4 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
          {at?.body}
        </div>
      </article>
    </section>
  );
}

/** One clause. It renders nothing of itself: `LegalColumn` reads the title
    and the body off it and draws both the contents list and the reading
    column from them. */
export function Clause(props: { title: string; children: React.ReactNode }) {
  void props;
  return null;
}
