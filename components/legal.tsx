"use client";

import * as React from "react";
import Link from "next/link";
import { Strip } from "@/components/strip";
import { StripPage, StripHead, TitleCell } from "@/components/strip-page";
import { cn } from "@/lib/utils";

/* ── the legal page ───────────────────────────────────────────────
 * Julian did not like the first horizontal version, which was the old
 * two column grid turned on its side: two tall documents that scrolled
 * inside themselves, which is a scroll bar inside a scroll bar. He asked
 * for an expanding horizontal strip, opened by pressing it.
 *
 * So every clause is a panel of its own, standing closed with its number
 * and its title set vertically down the spine. Press one and it opens
 * sideways into a column of text; press it again and it shuts. The page
 * is its own table of contents at rest, which is what these two
 * documents want: nobody reads a privacy policy, they look one thing up.
 *
 * Two documents, and the ruler underneath knows it. Each opens with a
 * panel carrying its title and the date it took effect, and that panel
 * carries the label, so the rail runs in two chapters and the clauses
 * are the cells inside them.
 *
 * The numbering is real, because it is how a clause gets cited in an
 * email, and each panel keeps the anchor it had: `/legal#terms-ownership`
 * still opens that clause and travels to it.
 * ─────────────────────────────────────────────────────────────── */

/** The clause that is open, and the way to open another. One at a time:
    two open panels put the text the reader is holding out of the window,
    and the strip is already the way to move between them. */
const Opened = React.createContext<{
  open: string | null;
  show: (id: string) => void;
}>({ open: null, show: () => {} });

export function LegalPage({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState<string | null>(null);

  /* Pressing a panel opens it and sends the strip to it. The strip
     travels to whichever cell the address names, so naming it is the
     whole of the journey; the event has to be dispatched by hand because
     `replaceState` changes the address and tells nobody. Never
     `location.hash =`, which would push a history entry for every clause
     anybody opened.

     Nothing here may happen inside the state updater. An updater runs
     during React's render, and dispatching from in there made the strip
     set its own state while this component was rendering, which React
     refuses. */
  const show = React.useCallback(
    (id: string) => {
      const next = open === id ? null : id;
      setOpen(next);
      const url = next ? `#${next}` : window.location.pathname;
      window.history.replaceState(null, "", url);
      if (next) window.dispatchEvent(new HashChangeEvent("hashchange"));
    },
    [open],
  );

  /* The address is not ours alone: having travelled, the strip writes the
     section it has arrived at over the top of it, so the address goes
     from `#terms-ownership` to `#terms` a moment after a press. Read
     back naively that shut the panel that had just been opened. Only an
     address that names a clause is allowed to change which one is open;
     anything else is the strip keeping its own score. */
  React.useEffect(() => {
    const read = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      const panel = document.getElementById(id);
      if (panel?.querySelector("button[aria-controls]")) setOpen(id);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  return (
    <Opened.Provider value={{ open, show }}>
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
          chapters
          className="mt-4 flex-1"
        >
          {/* No opener. Julian: remove it. Two titles and two dates say
              what the page is, and a paragraph explaining that a legal
              page is a legal page is the kind of writing these documents
              are trying not to be. */}
          <TitleCell title="Legal" hash="legal">
            <p className="label text-muted-foreground">The small print</p>
          </TitleCell>
          {children}
        </Strip>
      </StripPage>
    </Opened.Provider>
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
  /* A fragment, not a box. The strip reads its own children in a dozen
     places and a wrapper here would hide every panel from the ruler, the
     counter and the seat, so the document's head and its clauses are
     handed up as siblings. */
  return (
    <>
      <section
        id={id}
        aria-labelledby={`${id}-title`}
        data-tick
        data-label={label}
        data-hash={id}
        className="flex w-full shrink-0 flex-col justify-center gap-6 py-8 sm:h-full sm:w-[min(28rem,82vw)] sm:py-0 sm:pr-8"
      >
        <div>
          <h2
            id={`${id}-title`}
            className="font-display text-3xl uppercase leading-none tracking-[0] sm:text-4xl"
          >
            {title}
          </h2>
          <p className="label mt-4 text-muted-foreground">
            Effective <time dateTime={effective}>{shown}</time>
          </p>
        </div>
        <div className="max-w-prose text-base leading-relaxed">{intro}</div>
        <p className="label text-muted-foreground">
          {React.Children.count(children)} clauses. Press one to read it.
        </p>
      </section>

      {/* Each clause takes an anchor of its own, named for the document it
          is in: "Changes" and "Contact" are the title of a clause in both,
          and `/legal#terms-changes` and `/legal#privacy-changes` are
          different clauses. Passed down rather than typed at each of the
          call sites, which is a chance apiece to repeat one. */}
      {React.Children.map(children, (child, i) =>
        React.isValidElement<{ column?: string; n?: number }>(child)
          ? React.cloneElement(child, { column: id, n: i + 1 })
          : child,
      )}
    </>
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
  n = 0,
  children,
}: {
  title: string;
  /** Written by `LegalColumn`; the document this clause is in. */
  column?: string;
  /** Its place in that document, for the number down the spine. */
  n?: number;
  children: React.ReactNode;
}) {
  const id = column ? `${column}-${anchor(title)}` : anchor(title);
  const { open, show } = React.useContext(Opened);
  const shown = open === id;

  return (
    <div
      id={id}
      data-tick
      data-name={title}
      data-hash={id}
      className="flex w-full shrink-0 flex-col border-t border-border sm:h-full sm:w-auto sm:flex-row sm:border-l sm:border-t-0"
    >
      {/* The spine. Shut, this is the whole panel: a number at the top and
          the title read from the bottom up, which is the way a spine is
          read off a shelf. */}
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={`${id}-text`}
        onClick={() => show(id)}
        className={cn(
          "label group flex shrink-0 items-center gap-4 py-5 text-left transition-colors duration-200",
          /* Julian: the sideways text is super hard to read. It was ten
             pixels of letter-spaced capitals turned on its side, which is
             the worst setting type has, so the titles are the right way
             up now and the spine is as wide as a title needs. Thirty
             three of them make a longer strip; a strip is the one thing
             this page has plenty of. */
          "sm:h-full sm:w-44 sm:flex-col sm:items-start sm:gap-5 sm:px-5 sm:py-7",
          shown ? "text-foreground" : "text-muted-foreground",
          "hoverable:hover:text-foreground",
        )}
      >
        <span className="tabular-nums">
          {String(n).padStart(2, "0")}
        </span>
        {/* At the foot of the spine, where the eye lands after the
            number and where a shelf carries a title. */}
        <span className="min-w-0 flex-1 truncate sm:mt-auto sm:w-full sm:flex-none sm:overflow-visible sm:whitespace-normal sm:text-wrap sm:leading-[1.45]">
          {title}
        </span>
        {/* A cross that turns into a line: the shape says shut and open
            without a word, and turning is cheaper than swapping two
            glyphs. */}
        <span
          aria-hidden
          className={cn(
            "relative size-3 shrink-0 transition-transform duration-300 ease-[var(--ease-out-strong)] motion-reduce:transition-none",
            shown && "rotate-45",
          )}
        >
          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
          <span
            className={cn(
              "absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current transition-opacity duration-200",
              shown && "opacity-0",
            )}
          />
        </span>
      </button>

      {/* The text, opening sideways. A grid track from nothing to one
          fraction is the one way a width can be animated without naming
          the width, so a long clause and a short one both open at the
          same speed and neither is measured in advance. */}
      <div
        id={`${id}-text`}
        role="region"
        aria-label={title}
        className={cn(
          "grid transition-[grid-template-rows,grid-template-columns] duration-[420ms] ease-[var(--ease-out-strong)] motion-reduce:transition-none",
          "sm:h-full",
          shown
            ? "grid-rows-[1fr] sm:grid-cols-[1fr] sm:grid-rows-none"
            : "grid-rows-[0fr] sm:grid-cols-[0fr] sm:grid-rows-none",
        )}
      >
        <div className="min-h-0 min-w-0 overflow-hidden">
          <div
            data-scroll
            className="h-full w-full overflow-y-auto overscroll-contain pb-8 pr-2 text-base leading-relaxed sm:w-[min(32rem,76vw)] sm:py-7 sm:pl-6 sm:pr-8 [&_li]:mt-2 [&_p+p]:mt-4 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
