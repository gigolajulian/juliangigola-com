"use client";

import { useState } from "react";
import Link from "next/link";
import { RisingTitle } from "@/components/strip-page";
import type { Block, Faq } from "@/lib/booking";

/* ── the questions ────────────────────────────────────────────────
 * A booking page's screen of questions, the ones people search for
 * ("how much do headshots cost in san jose"), opened one at a time the
 * way the sessions open (`sessions-screen.tsx`). The closed answers are
 * folded, not removed: every answer is in the page for a search engine
 * and an AI answer to read, and `inert` keeps a closed one out of the
 * tab order and away from a screen reader until it is opened.
 * ─────────────────────────────────────────────────────────────── */

const two = (n: number) => String(n).padStart(2, "0");

export function LocalQuestions({
  faqs,
  details,
}: {
  faqs: Faq[];
  /** The session's price and turnaround, and what was the Details screen,
      beside the questions, Julian (2026-10-02): one screen for both. */
  details?: {
    facts: string[];
    blocks: (Block & { links?: { href: string; label: string }[] })[];
  };
}) {
  const [open, setOpen] = useState(0);
  const [shown, setShown] = useState(0);
  return (
    <section
      data-tick
      data-label="Questions"
      data-hash="questions"
      className="relative grid w-full shrink-0 grid-cols-1 gap-10 border-l border-border px-6 pb-12 pt-24 sm:h-full sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] sm:items-center sm:gap-x-[clamp(2rem,4vw,5rem)] sm:px-10 sm:pb-8 short:pt-20"
    >
      <div className="flex flex-col gap-5">
        <span className="label text-muted-foreground">
          <span className="mr-2 text-foreground">{two(faqs.length)}</span>
          Asked before booking
        </span>
        <RisingTitle text="Questions" className="sm:max-lg:text-5xl" />
        {details ? (
          <div className="title-rest mt-4 flex flex-col gap-4 border-t border-border pt-5">
            <p className="label text-foreground">{details.facts.join(" · ")}</p>
            {/* The old Details screen, folded the way the questions are and
                opened by pointing, Julian (2026-10-02). */}
            <ul className="flex flex-col">
              {details.blocks.map((b, i) => {
                const on = i === shown;
                return (
                  <li key={b.heading} className="border-b border-border">
                    <button
                      type="button"
                      aria-expanded={on}
                      onClick={() => setShown(on ? -1 : i)}
                      onPointerEnter={(e) => {
                        if (e.pointerType === "mouse") setShown(i);
                      }}
                      className={`label flex w-full items-baseline justify-between gap-4 py-2.5 text-left transition-colors duration-300 ${on ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {b.heading}
                      <span aria-hidden className={`transition-transform duration-300 ${on ? "rotate-45" : ""}`}>
                        +
                      </span>
                    </button>
                    <div
                      inert={!on}
                      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        {b.body ? (
                          <p className="max-w-[48ch] pb-3 text-left text-sm leading-relaxed text-muted-foreground">
                            {b.body}
                          </p>
                        ) : null}
                        {b.items?.length ? (
                          <ul className="flex flex-col gap-1.5 pb-3 text-sm text-muted-foreground">
                            {b.items.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        ) : null}
                        {b.links?.length ? (
                          <ul className="flex flex-col gap-1.5 pb-3 text-sm">
                            {b.links.map((l) => (
                              <li key={l.href}>
                                <Link
                                  href={l.href}
                                  className="text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
                                >
                                  {l.label} <span aria-hidden>&rarr;</span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      <ul
        data-scroll
        className="title-rest min-h-0 border-t border-border sm:max-h-full sm:overflow-y-auto sm:overflow-x-hidden sm:overscroll-contain"
      >
        {faqs.map((f, i) => {
          const on = i === open;
          return (
            <li key={f.q} className="border-b border-border">
              <h2 className="contents">
                <button
                  type="button"
                  aria-expanded={on}
                  onClick={() => setOpen(on ? -1 : i)}
                  /* Julian (2026-10-02): a mouse opens it by pointing. */
                  onPointerEnter={(e) => {
                    if (e.pointerType === "mouse") setOpen(i);
                  }}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-4 py-4 text-left normal-case short:py-2.5"
                >
                  <span
                    className={`label tabular-nums transition-colors duration-300 ${on ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {two(i + 1)}
                  </span>
                  {/* The display face set tight closes up its spaces at
                      this size; a question is a sentence and needs them. */}
                  <span className="font-display text-[clamp(1.125rem,1.6vw,1.625rem)] leading-tight tracking-[-0.02em] [word-spacing:0.14em]">
                    {f.q}
                  </span>
                  <span
                    aria-hidden
                    className={`text-lg transition-transform duration-300 ${on ? "rotate-45" : ""}`}
                  >
                    +
                  </span>
                </button>
              </h2>
              <div
                inert={!on}
                className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="min-h-0 overflow-hidden">
                  <p className="max-w-[60ch] pb-5 pl-[clamp(2rem,3vw,3rem)] text-left text-sm leading-relaxed text-muted-foreground">
                    {f.a}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
