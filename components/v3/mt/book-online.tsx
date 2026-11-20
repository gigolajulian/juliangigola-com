"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Duo } from "@/components/v3/duo";
import { V3BookFlow } from "@/components/v3/book";
import { SESSIONS } from "@/lib/v3";
import { matches } from "@/lib/device";
import { BOOK_ROWS, QUOTE_OPTS, type BookRow, type QuoteOpt } from "./data";
import { useNextOpen } from "./next-open";
import { CardsCtx } from "./ctx";

/* Book online: four sessions, one line each. A row is picked by hover (fine
   pointers), focus or tap, and the photo follows it. Booking finishes here:
   the list gives way to the LIVE flow (`V3BookFlow`: its own picker, the site's
   events, Stripe deposit and copy, untouched) and the photo stays. */

function RowPhoto({ r, on, sizes }: { r: BookRow; on: boolean; sizes: string }) {
  const p = SESSIONS[r.slug].photo;
  return (
    <span className={on ? "duo on" : "duo"} style={{ "--at": r.pos } as React.CSSProperties}>
      <Duo d={p.d} l={p.l} alt={`${r.name} sample`} sizes={sizes} />
    </span>
  );
}

export function MtBookOnline({ open, opener, onClose, quotePhoto, onRowPick }: { open: BookRow["slug"] | null; opener?: React.RefObject<HTMLElement | null>; onClose: () => void; quotePhoto: QuoteOpt["key"] | null; onRowPick: () => void }) {
  const cards = React.useContext(CardsCtx);
  const [sel, setSelRaw] = React.useState(0);
  const setSel = (i: number) => (setSelRaw(i), onRowPick());
  // desktop: the photo shows a By quote option while that list was the last one touched; never during a booking
  const q = open ? null : quotePhoto;
  const shownIdx = open ? Math.max(0, BOOK_ROWS.findIndex((x) => x.slug === open)) : sel;
  const r = BOOK_ROWS[shownIdx];
  const sec = React.useRef<HTMLElement>(null);
  const head = React.useRef<HTMLHeadingElement>(null);
  const rows = React.useRef<(HTMLButtonElement | null)[]>([]);
  const isOpen = React.useRef(false);

  // opening or closing puts the block back at the top of the screen and moves focus with it
  React.useEffect(() => {
    if (!!open === isOpen.current) return;
    isOpen.current = !!open;
    // opened from a footer link: closing goes back to that link, where the visitor started
    const back = !open && opener?.current;
    if (back) return back.focus();
    // by hand, not scrollIntoView: the page keeps a scroll padding for anchors that would leave a gap here; the offset is the block's own scroll-margin (the fixed header on phones)
    const el = sec.current;
    if (el) window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) });
    if (open) head.current?.focus({ preventScroll: true });
    else rows.current[shownIdx]?.focus({ preventScroll: true });
  }, [open, shownIdx, opener]);

  const next = useNextOpen(r.slug);
  const pick = (i: number) => {
    setSel(i);
    cards.book(BOOK_ROWS[i].slug);
  };
  return (
    <section id="sessions" className="mt-book" aria-label="Book online" data-mt="book" data-on={r.slug} data-open={open ? "" : undefined} ref={sec}>
      <div className="mt-frame">
        <h2 className="mt-bq-h">Sessions <span className="lbl mute">Book online</span></h2>
        <div className="mt-book-col">
          {open ? (
            <div className="mt-bin" onKeyDown={(e) => e.key === "Escape" && onClose()}>
              <div className="mt-bin-top">
                <button type="button" className="mt-link" onClick={onClose}>Back</button>
                <Link className="mt-link" href={`/book/${r.slug}`}>More about this session</Link>
              </div>
              <h3 className="mt-bin-t" tabIndex={-1} ref={head}>{r.name}</h3>
              <p className="lbl mt-bin-m">{r.len} <i aria-hidden>|</i> {r.price}</p>
              <div className="mt-bin-flow">
                {/* the live picker opens on Month; here it opens on the week */}
                <V3BookFlow key={r.slug} slug={r.slug} tabs={false} startView="week" />
              </div>
            </div>
          ) : (
            <>
              <div className="mt-brs">
                {BOOK_ROWS.map((x, i) => (
                  <div key={x.slug} className="mt-brw" data-on={i === sel || undefined}>
                    {/* a mouse picks by hover and books by click; a finger picks first, then books */}
                    <button
                      type="button"
                      className="mt-br"
                      ref={(el) => void (rows.current[i] = el)}
                      aria-pressed={i === sel}
                      onPointerEnter={() => matches("fine") && setSel(i)}
                      onFocus={(e) => e.currentTarget.matches(":focus-visible") && setSel(i)}
                      onClick={() => (matches("fine") || i === sel ? pick(i) : setSel(i))}
                    >
                      <b>{x.name}</b>
                      <span className="lbl">{x.len} <i aria-hidden>|</i> {x.price}</span>
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-act">
                <button type="button" className="btn fill mt-big" onClick={() => pick(sel)}>{r.btn}</button>
                {next ? <p className="lbl mt-next"><span className="mute">Next open</span> {next}</p> : null}
                <Link className="mt-link" href="/book">All sessions</Link>
              </div>
              <p className="lbl mute mt-dep">{r.dep} deposit secures your date and goes toward your balance.</p>
            </>
          )}
        </div>
        <figure className="mt-photo">
          {BOOK_ROWS.map((x, i) => <RowPhoto key={x.slug} r={x} on={q === null && i === shownIdx} sizes="(max-width: 1023px) 100vw, 42vw" />)}
          {QUOTE_OPTS.map((x) => <Image key={x.key} src={x.photo} alt={`${x.name} sample`} fill sizes="42vw" className={q === x.key ? "qp on" : "qp"} />)}
        </figure>
      </div>
      {/* Phone, tablet and on its side: the held bar while the screen is up. */}
      <div className="mt-bar">
        <p className="lbl mute">{next ? <>Next open<br />{next}</> : null}</p>
        <button type="button" className="btn fill" onClick={() => pick(sel)}>{r.btn}</button>
      </div>
    </section>
  );
}
