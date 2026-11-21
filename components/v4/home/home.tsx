"use client";

import * as React from "react";
import type { MtData, BookRow, QuoteOpt } from "@/lib/v4-home/data";
import { CardsCtx, type Cards, type InquiryMode } from "./ctx";
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
import { glideTo } from "@/components/v3/smooth-scroll";

/* v4 homepage (the home with NEXT_PUBLIC_V4_HOME=1; `?mtscroll=1` previews it on a rollback build; docs/mt-decisions.md): the screens at their resting
   state, with MtIntro and MtMotionLayer on top. Motion hooks: MOTION-HOOKS.md. */

export function MtHome({ data }: { data: MtData }) {
  const [book, setBook] = React.useState<BookRow["slug"] | null>(null);
  const [inq, setInq] = React.useState<{ from: InquiryMode; opt?: QuoteOpt["key"] } | null>(null);
  // the booking photo follows the last row touched in either list: a quote option's key, or null for the sessions
  const [quotePhoto, setQuotePhoto] = React.useState<QuoteOpt["key"] | null>(null);
  // The control that opened a card gets focus back when it closes (spec 3.6, 3.11).
  const opener = React.useRef<HTMLElement | null>(null);
  // a booking opened from the footer hands focus back to its footer link; from Sessions itself, to its row (book-online.tsx)
  const bookOpener = React.useRef<HTMLElement | null>(null);
  const cards = React.useMemo<Cards>(
    () => ({
      book: (k, el) => ((bookOpener.current = el ?? null), setBook(k)),
      inquire: (from, opt, el) => ((opener.current = el ?? (document.activeElement as HTMLElement | null)), setInq({ from, opt })),
    }),
    [],
  );
  const back = () => opener.current?.focus({ preventScroll: true });
  // Anchors (/sessions 308s to /#sessions; #about and #contact are linkable too): the screens take their heights after the browser's own anchor jump, so land again once they have.
  // #contact is the footer, and arriving there opens the inquiry card its "Contact me" opens; closing hands focus to that button.
  React.useEffect(() => {
    const target = () => (location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null);
    const land = () => {
      const el = target();
      if (el) scrollTo({ top: scrollY + el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) });
      return el;
    };
    const card = (el: HTMLElement | null) => {
      if (el?.id !== "contact") return;
      opener.current = el.querySelector<HTMLElement>(".mt-ph-btn");
      setInq({ from: "footer" });
    };
    const arrive = () => card(land());
    // already on the home: a link to /#contact glides down to the footer, then opens the card.
    // Taken at the click: by the time a hash change is heard the browser has jumped there.
    const go = (e: MouseEvent) => {
      const a = (e.target as Element).closest<HTMLAnchorElement>("a[href]");
      const el = document.getElementById("contact");
      if (!a || !el || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
      const u = new URL(a.href);
      if (u.origin !== location.origin || u.pathname !== "/" || u.hash !== "#contact") return;
      e.preventDefault();
      e.stopPropagation();
      if (location.hash !== "#contact") history.pushState(null, "", "/#contact");
      glideTo(scrollY + el.getBoundingClientRect().top, () => card(el));
    };
    const t = setTimeout(arrive, 300);
    if (document.readyState !== "complete") addEventListener("load", land, { once: true });
    // a link to one of these from the home itself changes the hash without a load
    addEventListener("hashchange", arrive);
    document.addEventListener("click", go, true);
    return () => (clearTimeout(t), removeEventListener("load", land), removeEventListener("hashchange", arrive), document.removeEventListener("click", go, true));
  }, []);
  return (
    <CardsCtx.Provider value={cards}>
      <MtIntro extras={data.extras} />
      <section className="v3 v3home mt" data-cards={inq ? "open" : undefined}>
        <MtHero frames={data.hero} extras={data.extras} />
        {/* order: Motion, Cover art, About, Sessions, By quote, then Commissions */}
        <MtFilms films={data.films} />
        <MtCovers />
        <MtAbout does={data.does} />
        <MtBookOnline open={book} opener={bookOpener} onClose={() => setBook(null)} quotePhoto={quotePhoto} onRowPick={() => setQuotePhoto(null)} />
        <MtByQuote stills={data.stills} reply={data.reply} onOptionPick={setQuotePhoto} />
        <MtCommissions frames={data.comm} />
        <MtFoot />
      </section>
      <MtMotionLayer />
      <InquiryCard open={inq} reply={data.reply} onClose={() => setInq(null)} onBack={back} />
    </CardsCtx.Provider>
  );
}
