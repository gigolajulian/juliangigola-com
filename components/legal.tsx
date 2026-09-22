"use client";

import * as React from "react";
import Link from "next/link";
import { StripPage, StripHead } from "@/components/strip-page";
import { cn } from "@/lib/utils";

/* ── the legal page ───────────────────────────────────────────────
 * One page, and nothing travels. The two instruments stand side by side
 * as two columns of numbered clauses, and the column on the right sets
 * out whichever clause the pointer is over or the last one pressed. Both
 * lists feed the one reading column, so a clause always arrives in the
 * same place and its heading says which document it came from.
 *
 * This is the fifth shape and the last of the reductions. A sideways
 * grid was two documents scrolling inside themselves; a panel per clause
 * read its titles sideways and ran to six thousand pixels of spine; a
 * modal covered the document it came out of; a strip of two pages made
 * the privacy policy a journey. Thirty three clauses fit on one screen
 * as a contents, which is how a bound instrument has always opened.
 *
 * The numbering is real, because it is how a clause gets cited in an
 * email, and every clause keeps its anchor: `/legal#terms-ownership`
 * opens that clause on arrival and the address follows what is pressed,
 * so a clause can be sent to somebody.
 * ─────────────────────────────────────────────────────────────── */

type Entry = {
  id: string;
  /** The document's short name, for the reading column's heading. */
  doc: string;
  n: number;
  title: string;
  body: React.ReactNode;
};

const Reading = React.createContext<{
  at: Entry | null;
  /** A press: this clause stays until another is pressed. */
  show: (e: Entry) => void;
  /** A pointer passing over: shown while it is there, and the pressed one
      comes back after. `null` is the pointer leaving. */
  peek: (e: Entry | null) => void;
  /** What a document offers at rest. The first offer wins, so the page
      opens at clause one of the terms. */
  offer: (e: Entry) => void;
}>({ at: null, show: () => {}, peek: () => {}, offer: () => {} });

export function LegalPage({ children }: { children: React.ReactNode }) {
  const [pick, setPick] = React.useState<Entry | null>(null);
  const [peek, setPeek] = React.useState<Entry | null>(null);
  const at = peek ?? pick;

  const show = React.useCallback((e: Entry) => {
    setPick(e);
    window.history.replaceState(null, "", `#${e.id}`);
  }, []);

  const offer = React.useCallback((e: Entry) => {
    setPick((was) => was ?? e);
  }, []);

  return (
    <Reading.Provider value={{ at, show, peek: setPeek, offer }}>
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
        <div className="flex min-h-0 flex-1 flex-col gap-10 px-6 pb-8 pt-4 sm:flex-row sm:items-stretch sm:gap-10 sm:px-10 sm:pb-6">
          {children}
          <ClauseText />
        </div>
      </StripPage>
    </Reading.Provider>
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
  const shown = new Date(`${effective}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  /* The clauses are read off the children rather than rendered by them.
     A `Clause` is a declaration, not a component: the contents and the
     reading column are two views of the same clause, and one of them
     cannot be drawn from inside the other. */
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
          doc: label,
          n: i + 1,
          title: c.props.title,
          body: c.props.children,
        })),
    [children, id, label],
  );

  const { at, show, peek, offer } = React.useContext(Reading);

  /* What the page opens on, and what an address asks for. The terms
     mount first, so at rest the page is open at their clause one. */
  React.useEffect(() => {
    const want = decodeURIComponent(window.location.hash.slice(1));
    const asked = clauses.find((c) => c.id === want);
    if (asked) show(asked);
    else offer(clauses[0]);
  }, [clauses, show, offer]);

  React.useEffect(() => {
    const read = () => {
      const want = decodeURIComponent(window.location.hash.slice(1));
      const asked = clauses.find((c) => c.id === want);
      if (asked) show(asked);
    };
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [clauses, show]);

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex min-h-0 shrink-0 flex-col sm:h-full sm:w-[var(--w)]"
      style={
        {
          /* The terms carry the longer titles and twice the clauses, so
             they take the wider column. Both hold every title on one
             line, which is what keeps thirty three rows on one screen. */
          "--w": id === "terms" ? "min(25rem,29%)" : "min(21rem,24%)",
        } as React.CSSProperties
      }
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-foreground pb-2">
        <h2
          id={`${id}-title`}
          className="font-display text-base uppercase leading-none tracking-[0.02em]"
        >
          {title}
        </h2>
        <p className="label shrink-0 text-muted-foreground">
          <time dateTime={effective}>{shown}</time>
        </p>
      </div>

      <ol
        className="m-0 min-h-0 list-none p-0 sm:flex-1 sm:overflow-y-auto sm:overscroll-contain"
        onMouseLeave={() => peek(null)}
      >
        {clauses.map((c) => (
          <li key={c.id} className="border-b border-border last:border-b-0">
            <button
              id={`${c.id}-open`}
              type="button"
              onClick={() => show(c)}
              onMouseEnter={() => peek(c)}
              onFocus={() => peek(c)}
              onBlur={() => peek(null)}
              aria-current={at?.id === c.id ? "true" : undefined}
              className={cn(
                "label flex w-full items-center gap-4 py-1.5 text-left text-sm leading-tight tracking-[0.06em] transition-colors duration-200",
                at?.id === c.id ? "text-foreground" : "text-muted-foreground",
                "hoverable:hover:text-foreground",
              )}
            >
              <span className="tabular-nums">{String(c.n).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1">{c.title}</span>
              {/* A rule that fills when the clause is the one being read:
                  the contents own marker, in the width a number takes. */}
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
    </section>
  );
}

/** The reading column. `aria-live` is deliberately absent: the text
    changes under the pointer, and announcing every clause somebody skims
    past is noise. The buttons name themselves. */
function ClauseText() {
  const { at } = React.useContext(Reading);
  if (!at) return null;
  return (
    <article
      aria-labelledby="legal-reading"
      className="min-w-0 flex-1 border-t border-border pt-5 sm:h-full sm:overflow-y-auto sm:overscroll-contain sm:border-l sm:border-t-0 sm:pl-10 sm:pt-0"
    >
      <h3 id="legal-reading" className="label text-muted-foreground">
        {at.doc}
        <span className="ml-4 tabular-nums">{String(at.n).padStart(2, "0")}</span>
        <span className="ml-4 text-foreground">{at.title}</span>
      </h3>
      <div className="mt-5 max-w-[40rem] text-base leading-relaxed [&_li]:mt-2 [&_p+p]:mt-4 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
        {at.body}
      </div>
    </article>
  );
}

/** One clause. It renders nothing of itself: `LegalColumn` reads the title
    and the body off it and draws both the contents and the reading column
    from them. */
export function Clause(props: { title: string; children: React.ReactNode }) {
  void props;
  return null;
}
