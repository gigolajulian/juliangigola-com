"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import type { HomeData, BookRow, QuoteOpt } from "@/lib/home/data";
import { CardsCtx, type Cards, type InquiryMode } from "./ctx";
import { HomeHero } from "./hero";
import { HomeCommissions } from "./commissions";
import { HomeCovers, HomeFilms } from "./rows";
import { BookOnline } from "./book-online";
import { ByQuote } from "./by-quote";
import { HomeAbout } from "./about";
import { HomeFoot } from "./foot";
import { HomeIntro } from "./intro";
import { MotionLayer } from "./motion";
import { glideTo, jumpTo } from "@/components/site/smooth-scroll";
import { useBackHome } from "./back";

/* The inquiry card (its dialog and form) is not in the home page's first load (audit): fetched once By quote
   or the footer nears the screen, or after the page has loaded and gone idle, so opening it never waits; mounted the
   first time it opens and kept, so it can close with its own animation. Not React.lazy: a Suspense reveal is held about
   300ms even when the module is already here. */
let InquiryCard: typeof import("./inquiry-card").InquiryCard | undefined;
let inqMod: Promise<unknown> | undefined;
const warmInq = () =>
  (inqMod ??= import("./inquiry-card").then(
    (m) => (InquiryCard = m.InquiryCard),
    () => (inqMod = undefined),
  ));

/* v4 homepage (docs/mt-decisions.md): the screens at their resting
   state, with HomeIntro and MotionLayer on top. Motion hooks: MOTION-HOOKS.md. */

export function Home({ data }: { data: HomeData }) {
  useBackHome();
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
  const [inqUsed, setInqUsed] = React.useState(false);
  if (inq && !inqUsed) setInqUsed(true);
  const [, inqIn] = React.useReducer((n: number) => n + 1, 0);
  // what this render drew, not the module now: the import can land between this commit and the effect, and nothing would draw the card
  const drewCard = !!InquiryCard;
  React.useEffect(() => {
    if (inq && !drewCard) void warmInq().then(inqIn);
  }, [inq, drewCard]);
  React.useEffect(() => {
    const io = window.IntersectionObserver
      ? new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && (warmInq(), io?.disconnect()), { rootMargin: "100% 0px" })
      : null;
    document.querySelectorAll(".mt-quote, #contact").forEach((el) => io?.observe(el));
    const idle = () => ("requestIdleCallback" in window ? requestIdleCallback(warmInq, { timeout: 3000 }) : setTimeout(warmInq, 1500));
    if (document.readyState === "complete") idle();
    else addEventListener("load", idle, { once: true });
    return () => {
      io?.disconnect();
      removeEventListener("load", idle);
    };
  }, []);
  // Anchors (/sessions 308s to /#sessions; #about and #contact are linkable too): the screens take their heights after the browser's own anchor jump, so land again once they have.
  // #contact is the footer, and arriving there opens the inquiry card its "Contact me" opens; closing hands focus to that button.
  React.useEffect(() => {
    const target = () => (location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null);
    const land = () => {
      const el = target();
      // jumpTo, not scrollTo: the browser's own jump can land in a held row, whose snap glide (Lenis) would carry on over a plain scrollTo
      if (el) jumpTo(scrollY + el.getBoundingClientRect().top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0));
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
    return () => (
      clearTimeout(t),
      removeEventListener("load", land),
      removeEventListener("hashchange", arrive),
      document.removeEventListener("click", go, true)
    );
  }, []);
  return (
    <CardsCtx.Provider value={cards}>
      <HomeIntro extras={data.extras} />
      <section className="v3 v3home mt" data-cards={inq ? "open" : undefined}>
        <HomeHero frames={data.hero} extras={data.extras} />
        {/* order: Motion, Cover art, About, Sessions, By quote, then Commissions */}
        <HomeFilms films={data.films} />
        <HomeCovers />
        <HomeAbout disciplines={data.disciplines} />
        <BookOnline
          open={book}
          opener={bookOpener}
          onClose={() => setBook(null)}
          quotePhoto={quotePhoto}
          onRowPick={() => setQuotePhoto(null)}
        />
        <ByQuote stills={data.stills} reply={data.reply} onOptionPick={setQuotePhoto} />
        <HomeCommissions frames={data.commissions} />
        <HomeFoot />
      </section>
      <MotionLayer />
      {InquiryCard && (inq || inqUsed) ? <InquiryCard open={inq} reply={data.reply} onClose={() => setInq(null)} onBack={back} /> : null}
      {/* a slow line: the card's frame comes up on the tap while its code is still on the way */}
      {inq && !InquiryCard
        ? createPortal(
            <div className="v3 contents">
              <div className="mt-dim mt-dim-q" onClick={() => setInq(null)} />
              <div className="mt-card mt-inq-wait" role="status">
                <p className="lbl mute">Loading</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </CardsCtx.Provider>
  );
}
