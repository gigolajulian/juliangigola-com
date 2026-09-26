"use client";

import * as React from "react";
import Link from "next/link";
import { Strip } from "@/components/strip";
import { StripPage, StripHead } from "@/components/strip-page";
import { cn } from "@/lib/utils";

/* ── the legal page ───────────────────────────────────────────────
 * Two screens, one document each, dealt as a deck like the homepage and
 * About (`lib/deck.ts`): the terms, then the privacy policy sliding in
 * over them. Julian asked for it on 25 September 2026, and for the
 * elements to be larger than the three-column page this replaces.
 *
 * Each screen is that page less its document picker, because the screen
 * is the picker: the document's name and date over its contents down the
 * left, and the clause under the pointer or the last one pressed set
 * large on the right. One document a screen is what keeps the contents
 * standing at a readable size without two lists fighting for one column.
 *
 * On a phone the two run down the page (`stack`), a document at a time,
 * because a legal document swiped sideways is a legal document nobody
 * reads.
 *
 * The numbering is real, because it is how a clause gets cited in an
 * email, and every clause keeps its anchor: `/legal#terms-ownership`
 * opens that screen on that clause on arrival (the strip finds the cell
 * holding the id, `cellFor` in `strip.tsx`) and the address follows what
 * is pressed, so a clause can be sent to somebody.
 * ─────────────────────────────────────────────────────────────── */

type Clause = { id: string; n: number; title: string; body: React.ReactNode };
type Doc = {
  id: string;
  title: string;
  /** The short name, for the running head and the reading column. */
  label: string;
  effective: string;
  clauses: Clause[];
};

const Shelf = React.createContext<(d: Doc) => void>(() => {});

/** A clause title as an anchor: "What you may do" becomes `what-you-may-do`. */
const anchor = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const dated = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const two = (n: number) => String(n).padStart(2, "0");

export function LegalPage({ children }: { children: React.ReactNode }) {
  /* The documents hand themselves up rather than drawing anything. The
     contents and the reading column are views of the same clause, and
     one of them cannot be drawn from inside the other. */
  const [docs, setDocs] = React.useState<Doc[]>([]);
  const shelve = React.useCallback((d: Doc) => {
    setDocs((was) => (was.some((o) => o.id === d.id) ? was : [...was, d]));
  }, []);

  /* The clause pressed, per document, and the one under the pointer. */
  const [pick, setPick] = React.useState<Record<string, string>>({});
  const [peek, setPeek] = React.useState<string | null>(null);

  const reading = (d: Doc) =>
    d.clauses.find((c) => c.id === peek) ??
    d.clauses.find((c) => c.id === pick[d.id]) ??
    d.clauses[0];

  const press = (d: Doc, c: Clause) => {
    setPick((was) => ({ ...was, [d.id]: c.id }));
    window.history.replaceState(null, "", `#${c.id}`);
    /* On a phone the columns are stacked blocks and the clause is below
       the whole contents, so a tap would change something the reader
       cannot see. There is no hover there either, so the tap is the only
       way in and it has to arrive. */
    if (window.matchMedia("(max-width: 39.99rem)").matches)
      document.getElementById(`${d.id}-clause`)?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
  };

  /* An address names a clause. The strip brings its screen in; this
     opens the clause on it. Read on arrival and on every later
     hashchange. */
  React.useEffect(() => {
    if (!docs.length) return;
    const read = () => {
      const want = decodeURIComponent(window.location.hash.slice(1));
      const d = docs.find((o) => o.clauses.some((c) => c.id === want));
      if (d) setPick((was) => ({ ...was, [d.id]: want }));
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [docs]);

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
        />
      }
    >
      <Shelf.Provider value={shelve}>{children}</Shelf.Provider>

      {/* Not until the documents are in: the strip reads the address on
          mount to find the screen it names, and a strip mounted with no
          cells finds nothing and stays on the first one. */}
      {docs.length > 0 && (
        <Strip
          label="Legal: the terms of service and the privacy policy, one screen each, left and right."
          paged
          bleed
          stack
          deck="screens"
          className="mt-4 flex-1"
        >
          {docs.map((d) => {
            const at = reading(d);
            return (
              <section
                key={d.id}
                data-tick
                data-label={d.label}
                data-hash={d.id}
                aria-label={d.title}
                className="flex w-full shrink-0 flex-col gap-10 px-6 pb-10 pt-6 sm:h-full sm:flex-row sm:gap-12 sm:px-10 sm:pb-6 sm:pt-2"
              >
                {/* The document and its contents. */}
                <div
                  className="flex min-h-0 flex-col sm:w-[min(40rem,42%)] sm:shrink-0"
                  onMouseLeave={() => setPeek(null)}
                >
                  <h2 className="font-display text-3xl uppercase leading-none tracking-[0.01em] sm:text-5xl">
                    {d.title}
                  </h2>
                  <p className="label mt-3 text-muted-foreground">
                    As of{" "}
                    <time dateTime={d.effective}>{dated(d.effective)}</time>
                  </p>
                  <ol className="mt-8 m-0 min-h-0 list-none p-0 sm:quiet-scroll sm:flex-1 sm:overflow-y-auto sm:overscroll-contain">
                    {d.clauses.map((c) => (
                      <li
                        key={c.id}
                        id={c.id}
                        className="border-b border-border first:border-t"
                      >
                        <button
                          type="button"
                          onClick={() => press(d, c)}
                          onMouseEnter={() => setPeek(c.id)}
                          onFocus={() => setPeek(c.id)}
                          onBlur={() => setPeek(null)}
                          aria-current={at.id === c.id ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-5 py-2.5 text-left text-base uppercase leading-tight tracking-[0.06em] tabular-nums transition-colors duration-200 sm:text-lg",
                            at.id === c.id
                              ? "text-foreground"
                              : "text-muted-foreground",
                            "hoverable:hover:text-foreground",
                          )}
                        >
                          <span>{two(c.n)}</span>
                          <span className="min-w-0 flex-1">{c.title}</span>
                          {/* A rule that fills when the clause is the one
                            being read: the contents own marker, in the
                            width a number takes. */}
                          <span
                            aria-hidden
                            className={cn(
                              "h-px w-5 shrink-0 transition-colors duration-200",
                              at.id === c.id
                                ? "bg-foreground"
                                : "bg-transparent",
                            )}
                          />
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* The clause itself. `aria-live` is deliberately absent: the
                  text changes under the pointer, and announcing every clause
                  somebody skims past is noise. The buttons name themselves.
                  Selectable, on a strip that is not: a clause gets copied
                  into an email. */}
                <article
                  id={`${d.id}-clause`}
                  aria-labelledby={`${d.id}-reading`}
                  className="min-w-0 flex-1 select-text border-t border-border pt-6 sm:h-full sm:quiet-scroll sm:overflow-y-auto sm:overscroll-contain sm:border-l sm:border-t-0 sm:pl-12 sm:pt-0"
                >
                  {/* Keyed on the clause, so the fade runs again on every
                    change rather than only on the first one. Opacity and
                    nothing else: a slide in from the side was wider than
                    the column for a few frames and put a scrollbar up. */}
                  <div
                    key={at.id}
                    className="animate-[jg-fade-in_240ms_var(--ease-out-strong)] motion-reduce:animate-none"
                  >
                    <p className="label text-muted-foreground">
                      {d.label}
                      <span className="ml-4">{two(at.n)}</span>
                    </p>
                    <h3
                      id={`${d.id}-reading`}
                      className="mt-3 font-display text-2xl uppercase leading-none tracking-[0.01em] sm:text-4xl"
                    >
                      {at.title}
                    </h3>
                    <div className="mt-8 max-w-[46rem] text-lg leading-relaxed [&_li]:mt-2 [&_p+p]:mt-5 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
                      {at.body}
                    </div>
                  </div>
                </article>
              </section>
            );
          })}
        </Strip>
      )}
    </StripPage>
  );
}

/** One document. It draws nothing: it reads its clauses off its children
    and hands the whole thing to the page, which lays out the screens. */
export function LegalColumn({
  id,
  title,
  label,
  effective,
  children,
}: {
  /** Anchor, so `/legal#terms` and `/legal#privacy` still land here. */
  id: string;
  title: string;
  /** The short name, carried into the running head and the reading column. */
  label: string;
  /** ISO date, so the machine and the reader see the same day. */
  effective: string;
  children: React.ReactNode;
}) {
  const shelve = React.useContext(Shelf);
  const clauses = React.useMemo(
    () =>
      React.Children.toArray(children)
        .filter(
          (
            c,
          ): c is React.ReactElement<{
            title: string;
            children: React.ReactNode;
          }> => React.isValidElement(c),
        )
        .map((c, i) => ({
          id: `${id}-${anchor(c.props.title)}`,
          n: i + 1,
          title: c.props.title,
          body: c.props.children,
        })),
    [children, id],
  );

  React.useEffect(() => {
    shelve({ id, title, label, effective, clauses });
  }, [shelve, id, title, label, effective, clauses]);

  return null;
}

/** One clause. A declaration, not a component: `LegalColumn` reads the
    title and the body off it. */
export function Clause(props: { title: string; children: React.ReactNode }) {
  void props;
  return null;
}
