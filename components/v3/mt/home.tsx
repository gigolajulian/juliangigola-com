"use client";

import * as React from "react";
import type { MtData, BookRow, QuoteOpt } from "./data";
import { CardsCtx, type Cards, type InquiryFrom } from "./ctx";
import { MtHero } from "./hero";
import { MtCommissions } from "./commissions";
import { MtCovers, MtFilms } from "./rows";
import { MtBookOnline } from "./book-online";
import { MtByQuote } from "./by-quote";
import { MtAbout } from "./about";
import { MtFoot } from "./foot";
import { InquiryCard } from "./inquiry-card";
import { MtIntro } from "./intro";
import { MtMotionLayer } from "./motion";

/* v4 homepage (`?mtscroll=1`, SPEC-home-scroll.md): the screens at their resting
   state, with MtIntro and MtMotionLayer on top. Motion hooks: MOTION-HOOKS.md. */

export function MtHome({ data }: { data: MtData }) {
  const [book, setBook] = React.useState<BookRow["key"] | null>(null);
  const [inq, setInq] = React.useState<{ from: InquiryFrom; opt?: QuoteOpt["key"] } | null>(null);
  // the booking photo follows the last row touched in either list: a quote option's index, or null for the sessions
  const [quotePhoto, setQuotePhoto] = React.useState<number | null>(null);
  // The control that opened a card gets focus back when it closes (spec 3.6, 3.11).
  const opener = React.useRef<HTMLElement | null>(null);
  const keep = () => (opener.current = document.activeElement as HTMLElement | null);
  const cards = React.useMemo<Cards>(() => ({ book: (k) => setBook(k), inquire: (from, opt) => (keep(), setInq({ from, opt })) }), []);
  const back = () => opener.current?.focus({ preventScroll: true });
  // Old links (/sessions, /about and /contact 308 to /#sessions, /#about, /#contact): the screens take their heights after the browser's own anchor jump, so land again once they have.
  React.useEffect(() => {
    const el = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
    if (!el) return;
    const land = () => scrollTo({ top: scrollY + el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) });
    const t = setTimeout(land, 300);
    if (document.readyState !== "complete") addEventListener("load", land, { once: true });
    return () => (clearTimeout(t), removeEventListener("load", land));
  }, []);
  return (
    <CardsCtx.Provider value={cards}>
      <MtIntro extras={data.extras} />
      <section className="v3 v3home mt" data-cards={inq ? "open" : undefined}>
        <MtHero frames={data.hero} extras={data.extras} />
        {/* order (Julian, 2026-11-17): Motion, Cover art, About, Sessions, By quote, then Commissions */}
        <MtFilms films={data.films} />
        <MtCovers />
        <MtAbout does={data.does} />
        <MtBookOnline open={book} onOpen={setBook} onClose={() => setBook(null)} quotePhoto={quotePhoto} onRowPick={() => setQuotePhoto(null)} />
        <MtByQuote stills={data.stills} reply={data.reply} onOptionPick={setQuotePhoto} />
        <MtCommissions frames={data.comm} />
        <MtFoot />
      </section>
      <MtMotionLayer />
      <InquiryCard at={inq} reply={data.reply} onClose={() => setInq(null)} onBack={back} />
    </CardsCtx.Provider>
  );
}
