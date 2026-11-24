"use client";

import * as React from "react";
import { pad } from "@/lib/utils";

/* ── the legal page ───────────────────────────────────────────────
 * The terms and the privacy policy. Each document reads its clauses off its
 * children (`LegalColumn`, `Clause`) and draws itself inside `LegalPage`. The
 * numbering is real, because it is how a clause gets cited in an email,
 * and every clause keeps its anchor: `/legal#terms-ownership` opens on it.
 * ─────────────────────────────────────────────────────────────── */

/** True inside `LegalPage`: a document on its own draws nothing. */
const InPage = React.createContext(false);

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


/** One document: its contents to the left, its clauses in full to the right. Outside the page it draws nothing. */
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
  const inPage = React.useContext(InPage);
  const clauses = React.Children.toArray(children)
    .filter((c): c is React.ReactElement<{ title: string; children: React.ReactNode }> => React.isValidElement(c))
    .map((c, i) => ({ id: `${id}-${anchor(c.props.title)}`, n: i + 1, title: c.props.title, body: c.props.children }));
  if (!inPage) return null;
  return (
    <section id={id} className="lg-doc" aria-label={title}>
      <nav className="lg-toc" aria-label={`${title}: contents`}>
        <h2 className="lg-t">{title}</h2>
        <p className="lbl mute">
          As of <time dateTime={effective}>{dated(effective)}</time>
        </p>
        <ol>
          {clauses.map((c) => (
            <li key={c.id}>
              <a href={`#${c.id}`}>
                <span className="mute">{pad(c.n)}</span>
                {c.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="lg-body">
        {clauses.map((c) => (
          <article key={c.id} id={c.id} className="lg-clause">
            <p className="lbl mute">
              {c.n === 1 ? label : null /* the part's name once, over its first clause (audit 2026-11-19) */}
              <span>{pad(c.n)}</span>
            </p>
            <h3>{c.title}</h3>
            <div className="lg-text">{c.body}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** One clause. A declaration, not a component: `LegalColumn` reads the
    title and the body off it. */
export function Clause(props: { title: string; children: React.ReactNode }) {
  void props;
  return null;
}

/* ── legal documents ──────────────────────────────────────────────
 * The same documents in the V3 page: the page head, then each document
 * with its contents held to the left while the clauses run in full on the
 * right at a reading measure. Every clause keeps its anchor, so
 * `/legal#terms-ownership` still lands on it.
 * ─────────────────────────────────────────────────────────────── */
export function LegalPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="v3 contents">
      <section className="v3page" id="p-legal">
        <div className="pg-head">
          <h1 className="pg-t">Legal</h1>
        </div>
        {/* each document draws itself, so its clauses are in the server HTML and the browser lands on `#terms-ownership` by itself */}
        <InPage.Provider value>{children}</InPage.Provider>
      </section>
    </div>
  );
}
