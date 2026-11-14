"use client";

import * as React from "react";
import type { MtData, BookRow, QuoteOpt } from "./data";
import { CardsCtx, type Cards, type InquiryFrom } from "./ctx";
import { MtHero } from "./hero";
import { MtCommissions } from "./commissions";
import { MtCovers, MtMotion } from "./rows";
import { MtBookOnline } from "./book-online";
import { MtByQuote } from "./by-quote";
import { MtAbout } from "./about";
import { MtFoot } from "./foot";
import { BookCard } from "./book-card";
import { InquiryCard } from "./inquiry-card";
import { MtIntro } from "./intro";

/* v4 homepage (`?mtscroll=1`, SPEC-home-scroll.md), the static build: every
   screen at its resting state. Motion hooks: MOTION-HOOKS.md. */


export function MtHome({ data }: { data: MtData }) {
  const [book, setBook] = React.useState<BookRow["key"] | null>(null);
  const [inq, setInq] = React.useState<{ from: InquiryFrom; opt?: QuoteOpt["key"] } | null>(null);
  const cards = React.useMemo<Cards>(() => ({ book: (k) => setBook(k), inquire: (from, opt) => setInq({ from, opt }) }), []);
  return (
    <CardsCtx.Provider value={cards}>
      <MtIntro extras={data.extras} />
      <section className="v3 v3home mt" data-cards={book || inq ? "open" : undefined}>
        <MtHero frames={data.hero} extras={data.extras} />
        <MtCommissions frames={data.comm} />
        <MtCovers />
        <MtMotion films={data.films} />
        <MtBookOnline />
        <MtByQuote stills={data.stills} reply={data.reply} />
        <MtAbout does={data.does} />
        <MtFoot />
      </section>
      <BookCard at={book} onTab={setBook} onClose={() => setBook(null)} />
      <InquiryCard at={inq} reply={data.reply} onClose={() => setInq(null)} />
    </CardsCtx.Provider>
  );
}
