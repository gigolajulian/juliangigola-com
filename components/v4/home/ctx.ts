"use client";

import * as React from "react";
import { flushSync } from "react-dom";
import type { BookRow, QuoteOpt } from "@/lib/mt-home";

/** The inquiry card's mode: "footer" is the Contact me card, "quote" the Inquire card (with an option), which the footer's Inquire links also open. */
export type InquiryMode = "footer" | "quote";
/** `el` is the footer link that opened it: closing hands focus back to it (Safari does not focus a clicked button, so it is passed, not read). */
export type Cards = {
  book: (row: BookRow["slug"], el?: HTMLElement) => void;
  inquire: (from: InquiryMode, opt?: QuoteOpt["key"], el?: HTMLElement) => void;
};
/** The openers, for every screen that opens one: inquire opens the inquiry card, book opens a session's booking inline in Sessions. */
export const CardsCtx = React.createContext<Cards>({ book: () => {}, inquire: () => {} });

/** Merges what a motion driver tells this section (motion/engine.ts `tell`) into its state: at once from a frame or an
    observer (flushSync), batched from the driver's setup or cleanup, which run inside an effect. */
export function useTold<T extends object>(ref: React.RefObject<HTMLElement | null>, set: React.Dispatch<React.SetStateAction<T>>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = (e: Event) => {
      const { now, ...d } = (e as CustomEvent<Partial<T> & { now: boolean }>).detail;
      const apply = () => set((s) => ({ ...s, ...d }));
      if (now) flushSync(apply);
      else apply();
    };
    el.addEventListener("mt-tell", on);
    return () => el.removeEventListener("mt-tell", on);
  }, [ref, set]);
}
