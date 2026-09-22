"use client";

import * as React from "react";
import Link from "next/link";
import { StripPage, StripHead } from "@/components/strip-page";
import { cn } from "@/lib/utils";

/* ── the legal page ───────────────────────────────────────────────
 * One page, three columns, and nothing travels. The documents are the
 * left column, the clauses of whichever one is open are the middle, and
 * the right sets out the clause under the pointer or the last one
 * pressed. One document's clauses at a time is what makes the middle
 * column fit its length: twenty one rows stand inside a window with
 * nothing to scroll, which was the point of the shape.
 *
 * The shapes before this one, and why they went: a sideways grid was two
 * documents scrolling inside themselves; a panel per clause read its
 * titles sideways and ran to six thousand pixels of spine; a modal
 * covered the document it came out of; a strip of two pages made the
 * privacy policy a journey; both contents at once left the privacy
 * titles wrapping in a column too narrow to hold them.
 *
 * The numbering is real, because it is how a clause gets cited in an
 * email, and every clause keeps its anchor: `/legal#terms-ownership`
 * opens that clause on arrival and the address follows what is pressed,
 * so a clause can be sent to somebody.
 * ─────────────────────────────────────────────────────────────── */

type Clause = { id: string; n: number; title: string; body: React.ReactNode };
type Doc = {
  id: string;
  title: string;
  /** The short name, for the reading column's heading. */
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

/** A document's place in the grid. Both rows are written out because a
    class built from an index is a class the stylesheet never sees. */
const ROWS = [
  { head: "sm:row-start-1", list: "roomy:row-start-1" },
  { head: "sm:row-start-2", list: "roomy:row-start-2" },
];

export function LegalPage({ children }: { children: React.ReactNode }) {
  /* The documents hand themselves up rather than drawing anything. The
     contents and the reading column are views of the same clause, and
     one of them cannot be drawn from inside the other. */
  const [docs, setDocs] = React.useState<Doc[]>([]);
  const shelve = React.useCallback((d: Doc) => {
    setDocs((was) => (was.some((o) => o.id === d.id) ? was : [...was, d]));
  }, []);

  const [open, setOpen] = React.useState<string | null>(null);
  const [pick, setPick] = React.useState<string | null>(null);
  const [peek, setPeek] = React.useState<string | null>(null);

  const doc = docs.find((d) => d.id === open) ?? docs[0];

  /* Whichever clause is being read, and the document it belongs to. Both
     contents are on the page at a tall window, so the pointer can be over
     a privacy clause while the terms are the open document, and the
     reading column has to say so. */
  const want = peek ?? pick;
  const found =
    docs
      .map((d) => ({ d, c: d.clauses.find((o) => o.id === want) }))
      .find((x) => x.c) ?? (doc ? { d: doc, c: doc.clauses[0] } : null);
  const at = found?.c;

  const press = (d: Doc, c: Clause) => {
    setOpen(d.id);
    setPick(c.id);
    window.history.replaceState(null, "", `#${c.id}`);
    /* On a phone the three columns are three stacked blocks and the clause
       is below the whole contents, so a tap would change something the
       reader cannot see. There is no hover there either, so the tap is
       the only way in and it has to arrive. */
    if (window.matchMedia("(max-width: 39.99rem)").matches)
      document
        .getElementById("legal-clause")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* An address names a clause, and a clause names its document: the
     anchor is the document's id and the clause's title. Read on arrival
     and on every later hashchange. */
  React.useEffect(() => {
    if (!docs.length) return;
    const read = () => {
      const want = decodeURIComponent(window.location.hash.slice(1));
      if (!want) return;
      const d = docs.find(
        (o) => o.id === want || o.clauses.some((c) => c.id === want),
      );
      if (!d) return;
      setOpen(d.id);
      if (d.clauses.some((c) => c.id === want)) setPick(want);
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

      <div className="flex min-h-0 flex-1 flex-col gap-10 px-6 pb-8 pt-4 sm:flex-row sm:items-stretch sm:gap-10 sm:px-10 sm:pb-6">
        {/* The documents and their contents, one grid, a row apiece. That
            is what puts a document's name at the foot of its own list:
            Julian asked for the name to sit where its clauses run out, and
            a row that holds both of them can align one to the other
            without either knowing how tall the other is. */}
        <div
          className={cn(
            "flex min-h-0 flex-col gap-10",
            "sm:grid sm:w-[min(43.5rem,52%)] sm:shrink-0 sm:grid-cols-[minmax(0,36%)_minmax(0,1fr)]",
            "sm:grid-rows-[auto_auto_minmax(0,1fr)] sm:gap-x-10 sm:gap-y-0",
            "sm:quiet-scroll sm:overflow-y-auto sm:overscroll-contain",
          )}
          onMouseLeave={() => setPeek(null)}
        >
          {docs.map((d, i) => {
            const here = d.id === doc?.id;
            /* A row apiece, written out rather than built, so the classes
               survive the stylesheet being generated from the source. */
            const row = ROWS[i] ?? ROWS[ROWS.length - 1];
            return (
              <React.Fragment key={d.id}>
                {/* The document. Two of them, so they are set at the size
                    of a thing you choose between rather than a line in a
                    list, and they stand at the foot of their own row. */}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(d.id);
                    setPick(d.clauses[0].id);
                    window.history.replaceState(null, "", `#${d.id}`);
                    /* On a tall window both contents are on the page, so
                       choosing a document is a move to its list rather
                       than a swap. */
                    document
                      .getElementById(`${d.id}-contents`)
                      ?.scrollIntoView({ block: "nearest" });
                  }}
                  aria-current={here ? "true" : undefined}
                  className={cn(
                    "group border-b border-border pb-3 text-left transition-colors duration-200",
                    /* At the head of the column on a window that shows one
                       document, and at the foot of its own list on one that
                       shows both, which is where Julian wants it: the name
                       sits where its clauses run out. */
                    "sm:col-start-1 sm:mb-6 sm:self-start roomy:self-end",
                    row.head,
                    here
                      ? "border-foreground"
                      : "hoverable:hover:border-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "block font-display text-xl uppercase leading-none tracking-[0.01em] transition-colors duration-200 sm:text-2xl",
                      here ? "text-foreground" : "text-muted-foreground",
                      "hoverable:group-hover:text-foreground",
                    )}
                  >
                    {d.title}
                  </span>
                  <span className="label mt-2 block text-muted-foreground">
                    {d.clauses.length} clauses
                  </span>
                  <span className="label block text-muted-foreground">
                    <time dateTime={d.effective}>{dated(d.effective)}</time>
                  </span>
                </button>

                {/* The contents. On a window short enough that one
                    document fills the column, only the open one is here,
                    which is what keeps the terms standing in a single
                    length. Above 75rem of window height there is room for
                    both, so both are listed. */}
                <section
                  id={`${d.id}-contents`}
                  aria-label={d.title}
                  className={cn(
                    "min-w-0 sm:col-start-2 sm:mb-6",
                    /* One document on show takes the whole column; two
                       take a row each, which is what lines a name up with
                       the foot of its own list. */
                    "sm:row-start-1 sm:row-end-[-1] roomy:row-end-auto",
                    row.list,
                    here ? "block" : "hidden roomy:block",
                  )}
                >
                  <ol className="m-0 list-none p-0">
                    {d.clauses.map((c) => (
                      <li
                        key={c.id}
                        className="border-b border-border first:border-t"
                      >
                        <button
                          id={`${c.id}-open`}
                          type="button"
                          onClick={() => press(d, c)}
                          onMouseEnter={() => setPeek(c.id)}
                          onFocus={() => setPeek(c.id)}
                          onBlur={() => setPeek(null)}
                          aria-current={at?.id === c.id ? "true" : undefined}
                          className={cn(
                            "label flex w-full items-center gap-4 py-1.5 text-left text-sm leading-tight tracking-[0.06em] transition-colors duration-200",
                            at?.id === c.id
                              ? "text-foreground"
                              : "text-muted-foreground",
                            "hoverable:hover:text-foreground",
                          )}
                        >
                          <span className="tabular-nums">
                            {String(c.n).padStart(2, "0")}
                          </span>
                          <span className="min-w-0 flex-1">{c.title}</span>
                          {/* A rule that fills when the clause is the one
                              being read: the contents own marker, in the
                              width a number takes. */}
                          <span
                            aria-hidden
                            className={cn(
                              "h-px w-4 shrink-0 transition-colors duration-200",
                              at?.id === c.id
                                ? "bg-foreground"
                                : "bg-transparent",
                            )}
                          />
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              </React.Fragment>
            );
          })}
        </div>

        {/* The clause itself. `aria-live` is deliberately absent: the text
            changes under the pointer, and announcing every clause somebody
            skims past is noise. The buttons name themselves. */}
        {at ? (
          <article
            id="legal-clause"
            aria-labelledby="legal-reading"
            className="min-w-0 flex-1 border-t border-border pt-5 sm:h-full sm:quiet-scroll sm:overflow-y-auto sm:overscroll-contain sm:border-l sm:border-t-0 sm:pl-10 sm:pt-0"
          >
            {/* Keyed on the clause, so the fade runs again on every change
                rather than only on the first one: a new key is a new
                element, and a new element plays its animation.

                Opacity and nothing else. Julian: a scrollbar appeared for
                an instant and went. It was this animation: the text came
                in from three quarters of a rem to the side, which is three
                quarters of a rem wider than the column for a few frames,
                and the browser put a bar up for it. */}
            <div
              key={at.id}
              className="animate-[jg-fade-in_240ms_var(--ease-out-strong)] motion-reduce:animate-none"
            >
              <h2 id="legal-reading" className="label text-muted-foreground">
                {found?.d.label}
                <span className="ml-4 tabular-nums">
                  {String(at.n).padStart(2, "0")}
                </span>
                <span className="ml-4 text-foreground">{at.title}</span>
              </h2>
              <div className="mt-5 max-w-[40rem] text-base leading-relaxed [&_li]:mt-2 [&_p+p]:mt-4 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
                {at.body}
              </div>
            </div>
          </article>
        ) : null}
      </div>
    </StripPage>
  );
}

/** One document. It draws nothing: it reads its clauses off its children
    and hands the whole thing to the page, which lays out the columns. */
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
  /** The short name, carried into the reading column's heading. */
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
          (c): c is React.ReactElement<{
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
