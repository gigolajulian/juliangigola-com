"use client";

import * as React from "react";
import { Suspense } from "react";
import { CalEmbed } from "@/components/cal-embed";
import { ContactForm } from "@/components/contact-form";
import { SESSION_TYPES } from "@/lib/sessions";
import type { MenuItem } from "@/lib/booking";
import { cn } from "@/lib/utils";
import { easeHeight } from "@/lib/ease-height";

const SESSIONS = SESSION_TYPES.map((s) => s.name);

/* ── the card alone ───────────────────────────────────────────────
 * The booking card by itself, for the Sessions screen as it was with the
 * card on its left (Julian, 2026-10-11): a session's calendar, or for a
 * commission a call or the form. Its own size container, so the form
 * keeps its fit (`.book-form`, contact.css).
 * ─────────────────────────────────────────────────────────────── */
export function BookCard({ item, onClose, className }: { item: MenuItem; onClose?: () => void; className?: string }) {
  const [tab, setTab] = React.useState<"call" | "form">("call");
  const mode = item.cal ? tab : "form";
  const card = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => (card.current ? easeHeight(card.current) : undefined), []);
  /* `?layout`: one frame for every step while Julian looks (contact.css). */
  React.useEffect(() => {
    if (new URLSearchParams(location.search).has("layout")) document.documentElement.dataset.layout = "";
  }, []);
  /* The browser's "Please fill out this field" bubble, said in the card's
     own type instead (Julian): a line under the field, gone once it is
     answered. The first one missing still takes the focus. */
  React.useEffect(() => {
    const el = card.current;
    if (!el) return;
    const say = (f: HTMLInputElement) =>
      f.validity.valueMissing ? (f.type === "radio" ? "Pick one" : "Required") : f.validity.typeMismatch && f.type === "email" ? "Check the email" : f.validationMessage;
    /* The inquiry form asks `checkValidity` as you type (contact-form.tsx),
       which fires these too: there, only on a send. */
    let sending = false;
    const onSubmit = () => {
      sending = true;
      setTimeout(() => (sending = false));
    };
    let n = 0;
    const onInvalid = (e: Event) => {
      const f = e.target as HTMLInputElement;
      e.preventDefault();
      if (f.form?.noValidate && !sending) return;
      const at = (f.type === "radio" ? (f.closest("fieldset") ?? f.parentElement?.parentElement) : (f.closest("label, .contact-field") ?? f.parentElement)) as HTMLElement | null;
      if (!at || at.querySelector(":scope > [data-said]")) return;
      const note = document.createElement("span");
      note.dataset.said = "";
      note.id = `said-${++n}`;
      note.className = "label mt-2 block text-foreground";
      note.textContent = say(f);
      at.append(note);
      // Read out with the field, and the field marked wrong.
      f.setAttribute("aria-describedby", `${f.getAttribute("aria-describedby") ?? ""} ${note.id}`.trim());
      f.setAttribute("aria-invalid", "true");
      if (!el.querySelector(":focus:invalid")) f.focus();
      const clear = () => {
        note.remove();
        f.setAttribute("aria-describedby", (f.getAttribute("aria-describedby") ?? "").replace(note.id, "").trim());
        if (!f.getAttribute("aria-describedby")) f.removeAttribute("aria-describedby");
        f.removeAttribute("aria-invalid");
        at.removeEventListener("input", clear);
        at.removeEventListener("change", clear);
      };
      at.addEventListener("input", clear);
      at.addEventListener("change", clear);
    };
    el.addEventListener("submit", onSubmit, true);
    el.addEventListener("invalid", onInvalid, true);
    return () => {
      el.removeEventListener("submit", onSubmit, true);
      el.removeEventListener("invalid", onInvalid, true);
    };
  }, []);
  return (
    <div
      ref={card}
      id="book-card"
      role="region"
      aria-label={`Book ${item.name}`}
      tabIndex={-1}
      className={cn("relative flex flex-col overflow-hidden rounded-[12px] border-[0.5px] border-border bg-card/60 outline-none backdrop-blur-xl backdrop-saturate-150 [--card-x:1.25rem] [--card-lift:0.8125rem] [container:card/size] sm:[--card-x:2.5rem] sm:[--card-lift:0.9375rem]", className)}
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
              {t === "call" ? "Book a call" : "Inquire"}
            </button>
          ))}
        </div>
      ) : item.cal ? (
        /* Julian: the calendar says what it is for, where no tabs do. */
        <h3 className="label font-bold text-foreground">Book a session</h3>
      ) : <span />}
        {/* Julian: the X larger, an easy target under a thumb. None on a
            booking page of its own (`app/book/[slug]`): nothing to close. */}
        {onClose ? <button type="button" onClick={onClose} className="tap-44 label inline-flex items-center gap-2 text-muted-foreground hoverable:hover:text-foreground">
          Close <span aria-hidden className="text-[1.75rem] font-light leading-none text-foreground">&times;</span>
        </button> : null}
      </div>
      <div key={`${item.slug}-${mode}`} className="min-h-0 flex-1 motion-safe:animate-[jg-fade-up_420ms_var(--ease-out-strong)_both]">
        {mode === "call" && item.cal ? (
          <CalEmbed path={item.cal} title={`Pick a time for ${item.name}`} className="booking-embed block h-full w-full border-0" />
        ) : (
          <div data-scroll className="h-full overflow-y-auto overscroll-contain px-[var(--card-x)] pb-6 pt-5">
            <div className="book-form flex flex-col gap-[clamp(1.25rem,4cqh,2.5rem)] sm:[&_textarea]:h-[3.75rem]">
              {/* Julian (2026-10-14): no promise line over the form; it
                  opens on the fields. */}
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
