"use client";

import * as React from "react";
import Link from "next/link";
import { QUOTE_OPTS } from "@/lib/home/data";
import { CardsCtx } from "./ctx";

/* "Have something in mind?": the ask with its two ways in (a note, a free call), and the four kinds of work I quote
   as rows. A row opens the inquiry card on that kind of work; Inquire opens it on the first, as the live block did at rest. */
export function ByQuote() {
  const cards = React.useContext(CardsCtx);
  return (
    <section className="mt-quote" data-mt="quote" aria-labelledby="mt-ask-h">
      <div className="mt-frame mt-ask">
        <div>
          <h2 className="mt-ask-h" id="mt-ask-h">
            Have something in mind?
          </h2>
          <p className="mt-ask-note">
            Send a note or book a free call. <b>I&apos;ll reply with an approach and a quote.</b> Outside the Bay Area, travel is in the quote.
          </p>
          <div className="mt-ask-cta">
            <button type="button" className="btn fill" onClick={(e) => cards.inquire("quote", QUOTE_OPTS[0].key, e.currentTarget)}>
              Inquire
            </button>
            <Link className="mt-link" href={QUOTE_OPTS[0].call}>
              Book a free 15-minute call
            </Link>
          </div>
        </div>
        <div className="mt-ask-rows">
          {QUOTE_OPTS.map((o) => (
            <button
              key={o.key}
              type="button"
              className="mt-ask-row"
              aria-label={`Inquire about ${o.name.toLowerCase()}`}
              onClick={(e) => cards.inquire("quote", o.key, e.currentTarget)}
            >
              <b>{o.name}</b>
              <span className="lbl">{o.holds.join(" | ")}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
