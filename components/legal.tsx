"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Strip } from "@/components/strip";
import { StripPage, StripHead } from "@/components/strip-page";

/* ── the legal page ───────────────────────────────────────────────
 * Two pages, and that is the whole of it. One is the terms, one is the
 * privacy policy, each a screen of its own along the strip: the title
 * and the opening on the left, every clause listed on the right. Press
 * a clause and its text comes up over the page.
 *
 * Third shape, and the reason for it. The two column grid turned
 * sideways was two documents scrolling inside themselves. The clause per
 * panel strip read its titles sideways, then read them upright and ran
 * to six thousand pixels of spine. A list is what a contract has always
 * carried at the front, and somebody who wants clause nine wants clause
 * nine, not the eight in front of it.
 *
 * The numbering is real, because it is how a clause gets cited in an
 * email, and every clause keeps its anchor: `/legal#terms-ownership`
 * opens that clause on arrival, and the address follows whatever is
 * open, so a clause can be sent to somebody.
 * ─────────────────────────────────────────────────────────────── */

const Opened = React.createContext<{
  open: string | null;
  show: (id: string) => void;
  hide: () => void;
}>({ open: null, show: () => {}, hide: () => {} });

export function LegalPage({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState<string | null>(null);

  /* `replaceState`, never `location.hash =`, which would push a history
     entry for every clause anybody glanced at and bury the back button.
     And nothing here may sit inside a state updater: an updater runs
     during render, and React refuses a component that touches anything
     else from in there. */
  const show = React.useCallback((id: string) => {
    setOpen(id);
    window.history.replaceState(null, "", `#${id}`);
  }, []);

  const hide = React.useCallback(() => {
    setOpen(null);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  /* The address is not ours alone: the strip writes the cell it has
     arrived at over the top of it, so `#terms-ownership` becomes `#terms`
     a moment after a press. Only an address that names a clause is
     allowed to open one; anything else is the strip keeping its score. */
  React.useEffect(() => {
    const read = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && document.getElementById(`${id}-open`)) setOpen(id);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  return (
    <Opened.Provider value={{ open, show, hide }}>
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
  const count = React.Children.count(children);
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-tick
      data-label={label}
      data-hash={id}
      /* One document, one screen. Julian: two pages total, so the second
         document is one gesture away rather than eleven. */
      className="flex w-full shrink-0 flex-col gap-8 py-8 sm:h-full sm:w-full sm:flex-row sm:items-stretch sm:gap-16 sm:py-0 sm:pr-10"
    >
      <div className="flex shrink-0 flex-col justify-center gap-6 sm:w-[min(22rem,32%)]">
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
          {count} clauses. Press one to read it.
        </p>
      </div>

      {/* Two columns from `sm`, because twenty one clauses down one column
          is taller than any window, and the point of a list is that the
          whole document is in view at once. */}
      <ol className="m-0 min-w-0 flex-1 list-none p-0 sm:my-auto sm:columns-2 sm:gap-x-12">
        {React.Children.map(children, (child, i) =>
          React.isValidElement<{ column?: string; n?: number }>(child)
            ? React.cloneElement(child, { column: id, n: i + 1 })
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
  n = 0,
  children,
}: {
  title: string;
  /** Written by `LegalColumn`; the document this clause is in. */
  column?: string;
  /** Its place in that document, for the number in the list. */
  n?: number;
  children: React.ReactNode;
}) {
  const id = column ? `${column}-${anchor(title)}` : anchor(title);
  const { open, show, hide } = React.useContext(Opened);

  return (
    <li className="break-inside-avoid border-b border-border">
      <button
        id={`${id}-open`}
        type="button"
        onClick={() => show(id)}
        className="label flex w-full items-center gap-4 py-3 text-left text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
      >
        <span className="tabular-nums">{String(n).padStart(2, "0")}</span>
        <span className="min-w-0 flex-1">{title}</span>
        {/* A cross: there is more behind the line, and pressing brings it
            up. Cheaper than a glyph and it does not need a font. */}
        <span aria-hidden className="relative size-3 shrink-0">
          <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-current" />
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-current" />
        </span>
      </button>
      {open === id ? (
        <ClauseText id={id} title={title} n={n} onClose={hide}>
          {children}
        </ClauseText>
      ) : null}
    </li>
  );
}

/** The clause itself, over the page. A `dialog` opened as a modal, so the
    platform does the focus trap, the Escape key and the inert background,
    and a portal to the body so none of it sits among the strip's cells,
    which the strip counts and rules off. */
function ClauseText({
  id,
  title,
  n,
  onClose,
  children,
}: {
  id: string;
  title: string;
  n: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const box = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = box.current;
    if (el && !el.open) el.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={box}
      aria-labelledby={`${id}-heading`}
      onClose={onClose}
      /* A press on the backdrop reaches the dialog element itself: the
         panel inside it takes every press of its own. */
      onClick={(e) => {
        if (e.target === box.current) box.current?.close();
      }}
      className="clause-box m-auto max-h-[82dvh] w-[min(37rem,92vw)] overflow-hidden border border-border bg-background p-0 text-foreground backdrop:bg-background/70"
    >
      <div className="flex max-h-[82dvh] flex-col">
        <div className="flex items-start justify-between gap-6 border-b border-border px-7 py-5">
          <h2 id={`${id}-heading`} className="label text-muted-foreground">
            <span className="tabular-nums">{String(n).padStart(2, "0")}</span>
            <span className="ml-4 text-foreground">{title}</span>
          </h2>
          <button
            type="button"
            onClick={() => box.current?.close()}
            className="label -m-2 shrink-0 p-2 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-7 py-6 text-base leading-relaxed [&_li]:mt-2 [&_p+p]:mt-4 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
