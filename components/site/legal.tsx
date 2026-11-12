"use client";

import * as React from "react";

/* ── the legal page ───────────────────────────────────────────────
 * The terms and the privacy policy. Each document hands its clauses up to
 * the page (`LegalColumn`, `Clause`), and `V3LegalPage` lays them out. The
 * numbering is real, because it is how a clause gets cited in an email,
 * and every clause keeps its anchor: `/legal#terms-ownership` opens on it.
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

/* ── JG V3 (leftovers card G) ─────────────────────────────────────
 * The same documents in the V3 page: the page head, then each document
 * with its contents held to the left while the clauses run in full on the
 * right at a reading measure. Every clause keeps its anchor, so
 * `/legal#terms-ownership` still lands on it.
 * ─────────────────────────────────────────────────────────────── */
export function V3LegalPage({ children }: { children: React.ReactNode }) {
  const [docs, setDocs] = React.useState<Doc[]>([]);
  const shelve = React.useCallback((d: Doc) => {
    setDocs((was) => (was.some((o) => o.id === d.id) ? was : [...was, d]));
  }, []);
  /* The address names a clause: once the documents are in, go to it. */
  React.useEffect(() => {
    if (!docs.length) return;
    const want = decodeURIComponent(window.location.hash.slice(1));
    if (want) document.getElementById(want)?.scrollIntoView({ block: "start" });
  }, [docs]);
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-legal">
        <Shelf.Provider value={shelve}>{children}</Shelf.Provider>
        <div className="pg-head">
          <h1 className="pg-t">Legal</h1>
        </div>
        {docs.map((d) => (
          <section key={d.id} id={d.id} className="lg-doc" aria-label={d.title}>
            <nav className="lg-toc" aria-label={`${d.title}: contents`}>
              <h2 className="lg-t">{d.title}</h2>
              <p className="lbl mute">
                As of <time dateTime={d.effective}>{dated(d.effective)}</time>
              </p>
              <ol>
                {d.clauses.map((c) => (
                  <li key={c.id}>
                    <a href={`#${c.id}`}>
                      <span className="mute">{two(c.n)}</span>
                      {c.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="lg-body">
              {d.clauses.map((c) => (
                <article key={c.id} id={c.id} className="lg-clause">
                  <p className="lbl mute">
                    {d.label}
                    <span>{two(c.n)}</span>
                  </p>
                  <h3>{c.title}</h3>
                  <div className="lg-text">{c.body}</div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </section>
    </div>
  );
}
