"use client";

import * as React from "react";
import type { BookRow, QuoteOpt } from "./data";

/** "footer" opens "Contact me", "quote" opens "Inquire" with an option. */
export type InquiryFrom = "footer" | "quote";
export type Cards = {
  book: (row: BookRow["key"]) => void;
  inquire: (from: InquiryFrom, opt?: QuoteOpt["key"]) => void;
};
/** The two cards' openers, for every screen that opens one. */
export const CardsCtx = React.createContext<Cards>({ book: () => {}, inquire: () => {} });
