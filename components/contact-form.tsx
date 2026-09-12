"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { submitEnquiry, type ContactState } from "@/app/contact/actions";
import { RESPONSE_TIME } from "@/lib/site";
import { cn } from "@/lib/utils";

/* ── the enquiry ──────────────────────────────────────────────────
 * The old form was three fields: name, email, message. Which means every
 * enquiry arrived with none of what Julian needs to answer it, and every
 * reply had to start by asking.
 *
 * So the first question is what kind of shoot it is, and that answer changes
 * the second question — a session wants a date, a campaign wants usage
 * rights. One extra tap, and the enquiry arrives answerable.
 * ─────────────────────────────────────────────────────────────── */

const TYPES = [
  { value: "editorial", label: "Editorial" },
  { value: "campaign", label: "Campaign" },
  { value: "music", label: "Music" },
  { value: "session", label: "Session" },
  { value: "other", label: "Other" },
] as const;

/** What to ask second, given the first answer. */
const FOLLOW_UP: Record<string, { label: string; placeholder: string }> = {
  editorial: {
    label: "Publication and issue date",
    placeholder: "e.g. print, March issue, closing 14 Feb",
  },
  campaign: {
    label: "Usage and territory",
    placeholder: "e.g. paid social + web, 12 months, North America",
  },
  music: {
    label: "Artist and release date",
    placeholder: "e.g. cover art, single out 3 May",
  },
  session: {
    label: "Preferred date and how many people",
    placeholder: "e.g. a Saturday in May, two of us",
  },
  other: {
    label: "Anything that helps place it",
    placeholder: "Optional",
  },
};

const INITIAL: ContactState = { status: "idle" };

export function ContactForm() {
  const params = useSearchParams();

  // /sessions links here with the type pre-chosen, so someone who has already
  // said what they want is not asked again.
  const preset = params.get("type");
  const presetSession = params.get("session");
  // Set by the CTA at the end of a project page, so the enquiry arrives
  // saying which work prompted it — the single most useful thing an enquiry
  // can carry, and the visitor never had to type it.
  const presetRef = params.get("ref");

  const [type, setType] = React.useState<string>(
    TYPES.some((t) => t.value === preset) ? (preset as string) : "editorial",
  );
  const [state, formAction, pending] = React.useActionState(
    submitEnquiry,
    INITIAL,
  );

  const followUp = FOLLOW_UP[type] ?? FOLLOW_UP.other;
  const values = state.values ?? {};

  if (state.status === "sent") {
    return (
      /* Centred, and the only block on this page that is.
         
         Everything else here is a form — labels, fields and errors all read
         down a left edge, because that is what you scan while filling one in.
         There is nothing left to fill in: this is one short piece of news,
         and it is the last thing the visitor sees. */
      <div
        role="status"
        className="flex flex-col items-center border border-border p-8 text-center"
      >
        <h2 className="font-display text-2xl uppercase tracking-[0]">Sent!</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {state.message}
        </p>
        {RESPONSE_TIME ? (
          <p className="label mt-4 text-muted-foreground">
            Replies {RESPONSE_TIME}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      {/* The honeypot. Hidden from sight, from the tab order and from
          assistive technology, so anything that fills it is filling every
          input on the page rather than reading the form. `app/contact/actions.ts`
          decides what happens then.

          `sr-only` is deliberately not used: that keeps a field available to
          a screen reader, which is the one visitor this must never trouble.
          `hidden` plus the rest means nobody real can reach it. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        hidden
      />
      <fieldset>
        <legend className="label text-muted-foreground">
          What kind of shoot?
        </legend>
        <div className="mt-4 flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <label
              key={t.value}
              className={cn(
                "label cursor-pointer border px-4 py-3 transition-colors duration-200",
                "focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ring)]",
                type === t.value
                  ? "border-foreground text-foreground"
                  : "border-border text-muted-foreground hoverable:hover:border-foreground/40 hoverable:hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                // Visually hidden rather than `hidden`, so it stays in the
                // tab order and arrow keys still walk the radio group.
                className="sr-only"
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        name="name"
        label="Name"
        defaultValue={values.name}
        error={state.errors?.name}
        autoComplete="name"
        required
      />

      <Field
        name="email"
        label="Email"
        type="email"
        defaultValue={values.email}
        error={state.errors?.email}
        autoComplete="email"
        required
      />

      <Field
        name="detail"
        label={followUp.label}
        placeholder={followUp.placeholder}
        // Keyed on `type` so switching shoot type actually swaps the field
        // rather than leaving an answer to the previous question in it.
        key={`detail-${type}`}
        defaultValue={
          values.detail ||
          (presetRef ? `Similar to ${presetRef}` : undefined) ||
          (presetSession && type === "session" ? presetSession : undefined)
        }
      />

      <Field
        name="message"
        label="About the project"
        as="textarea"
        defaultValue={values.message}
        error={state.errors?.message}
        required
      />

      {state.status === "error" || state.status === "unconfigured" ? (
        <div
          role="alert"
          className={cn(
            "border p-5 text-sm leading-relaxed",
            state.status === "error"
              ? "border-destructive/50"
              : "border-border",
          )}
        >
          <p>{state.message}</p>
          {state.mailto ? (
            <a
              href={state.mailto}
              className="label mt-4 inline-block underline decoration-border underline-offset-4 transition-colors duration-200 hoverable:hover:decoration-current"
            >
              Open in your mail app
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-6">
        <button
          type="submit"
          disabled={pending}
          className="label border border-foreground bg-foreground px-6 py-4 text-background press active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send enquiry"}
        </button>
        <p className="text-xs text-muted-foreground">
          Or email{" "}
          <a
            href="mailto:hello@juliangigola.com"
            className="underline decoration-border underline-offset-4 transition-colors duration-200 hoverable:hover:text-foreground"
          >
            hello@juliangigola.com
          </a>
        </p>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  error,
  as = "input",
  ...props
}: {
  name: string;
  label: string;
  error?: string;
  as?: "input" | "textarea";
} & React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  const Element = as;

  return (
    <div>
      <label htmlFor={id} className="label block text-muted-foreground">
        {label}
        {props.required ? <span aria-hidden> *</span> : null}
      </label>

      <Element
        id={id}
        name={name}
        rows={as === "textarea" ? 6 : undefined}
        aria-invalid={error ? true : undefined}
        // Points a screen reader at the message rather than only colouring
        // the border, which says nothing to anyone not looking at it.
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "mt-3 block w-full border-0 border-b bg-transparent py-3 text-base",
          "transition-colors duration-200 placeholder:text-muted-foreground/60",
          "focus:outline-none focus:border-foreground",
          error ? "border-destructive" : "border-border",
        )}
        {...props}
      />

      {error ? (
        <p id={errorId} className="mt-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
