"use client";

import * as React from "react";
import type { BookRow, QuoteOpt } from "./data";

/** The inquiry card's mode: "footer" is the Contact me card, "quote" the Inquire card (with an option), which the footer's Inquire links also open. */
export type InquiryMode = "footer" | "quote";
/** `el` is the footer link that opened it: closing hands focus back to it (Safari does not focus a clicked button, so it is passed, not read). */
export type Cards = {
  book: (row: BookRow["slug"], el?: HTMLElement) => void;
  inquire: (from: InquiryMode, opt?: QuoteOpt["key"], el?: HTMLElement) => void;
};
/** The openers, for every screen that opens one: inquire opens the inquiry card, book opens a session's booking inline in Sessions. */
export const CardsCtx = React.createContext<Cards>({ book: () => {}, inquire: () => {} });
