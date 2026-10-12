"use client";

import * as React from "react";
import { Suspense } from "react";
import { CalEmbed } from "@/components/cal-embed";
import { ContactForm } from "@/components/contact-form";
import { SESSION_TYPES } from "@/lib/sessions";
import type { MenuItem } from "@/lib/booking";
import { cn } from "@/lib/utils";

const SESSIONS = SESSION_TYPES.map((s) => s.name);

/* ── the card alone ───────────────────────────────────────────────
 * The booking card by itself, for the Sessions screen as it was with the
 * card on its left (Julian, 2026-10-11): a session's calendar, or for a
 * commission a call or the form. Its own size container, so the form
 * keeps its fit (`.book-form`, contact.css).
 * ─────────────────────────────────────────────────────────────── */
export function BookCard({ item, onClose, className }: { item: MenuItem; onClose: () => void; className?: string }) {
  const [tab, setTab] = React.useState<"call" | "form">("call");
  const mode = item.cal ? tab : "form";
  return (
    <div
      id="book-card"
      role="region"
      aria-label={`Book ${item.name}`}
      tabIndex={-1}
      className={cn("relative flex flex-col overflow-hidden rounded-[12px] border-[0.5px] border-border bg-card/60 outline-none backdrop-blur-xl backdrop-saturate-150 [--card-x:1.25rem] [container-type:size] sm:[--card-x:2.5rem]", className)}
    >
      {/* The card's own top line: the ways to reach me on the left where
          there are two, Close on the right. Nothing scrolls under it
          (Julian, 2026-10-11: room up top for Close). */}
      <div className="flex shrink-0 items-center justify-between gap-5 px-[var(--card-x)] pt-3 sm:pt-4">
      {item.cal && item.form ? (
        <div className="flex gap-5" role="group" aria-label="How to reach me">
          {(["call", "form"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={mode === t}
              onClick={() => setTab(t)}
              className={cn("tap-44 label border-b pb-1 transition-colors duration-200", mode === t ? "border-current text-foreground" : "border-transparent text-muted-foreground hoverable:hover:text-foreground")}
            >
              {t === "call" ? "Book a call" : "Send details"}
            </button>
          ))}
        </div>
      ) : <span />}
        <button type="button" onClick={onClose} className="tap-44 label text-muted-foreground hoverable:hover:text-foreground">
          Close <span aria-hidden>&times;</span>
        </button>
      </div>
      <div key={`${item.slug}-${mode}`} className="min-h-0 flex-1 motion-safe:animate-[jg-fade-up_420ms_var(--ease-out-strong)_both]">
        {mode === "call" && item.cal ? (
          <CalEmbed path={item.cal} title={`Pick a time for ${item.name}`} className="booking-embed block h-full w-full border-0" />
        ) : (
          <div data-scroll className="h-full overflow-y-auto overscroll-contain px-[var(--card-x)] pb-6 pt-5">
            <div className="book-form flex flex-col gap-[clamp(1.25rem,4cqh,2.5rem)] sm:[&_textarea]:h-[3.75rem]">
              {/* The promise in the labels' voice over a hairline, so the
                  card opens as a conversation. */}
              <div className="border-b-[0.5px] border-foreground/30 pb-[clamp(1.25rem,4cqh,2rem)]">
                <p className="label max-w-[48ch] leading-relaxed text-muted-foreground">Tell me what you have in mind. I reply within 24 hours with an approach and a quote.</p>
              </div>
              <Suspense fallback={null}>
                <ContactForm defaults={item.form} sessions={SESSIONS} />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
