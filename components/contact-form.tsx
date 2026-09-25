"use client";

import * as React from "react";
import Link from "next/link";
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
  { value: "portrait", label: "Portrait" },
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
  portrait: {
    label: "Who it is for, and roughly when",
    placeholder: "e.g. an actor's headshots, some time in June",
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

  /* The send button is dead until there is something to send. Julian
     asked: an enquiry that goes nowhere because a field was missed is
     an enquiry lost, and the button saying so before it is pressed is
     cheaper than an error after. */
  const [ready, setReady] = React.useState(false);
  const [emailHint, setEmailHint] = React.useState<string>();
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
         and it is the last thing the visitor sees.

         `self-start` because the form sits in a grid column and a grid
         stretches its items by default: with the form gone, this box grew to
         the height of the contact details beside it, and four lines of text
         sat at the top of seven hundred pixels of nothing. It hugs its
         content now.

         Everything inside arrives in order — mark, heading, line, promise —
         on the same `rise` and `--reveal-delay` the rest of the site uses.
         The stagger is what makes it read as something that just happened
         rather than a screen that was always there. */
      <div
        role="status"
        className="flex flex-col items-center self-start border border-border px-8 py-12 text-center sm:px-12"
      >
        <SentMark />

        <h2
          style={{ "--reveal-delay": "260ms" } as React.CSSProperties}
          className="rise font-display mt-6 text-3xl uppercase tracking-[0]"
        >
          Sent.
        </h2>

        <p
          style={{ "--reveal-delay": "360ms" } as React.CSSProperties}
          className="rise mt-3 max-w-[30ch] text-sm leading-relaxed text-muted-foreground"
        >
          {state.message}
        </p>

        {RESPONSE_TIME ? (
          <p
            style={{ "--reveal-delay": "460ms" } as React.CSSProperties}
            className="rise label mt-8 border-t border-border pt-6 text-muted-foreground"
          >
            Replies {RESPONSE_TIME}
          </p>
        ) : null}

        {/* Somewhere to go. The form was the only thing on this half of the
            page, so without this the confirmation is a dead end — and the
            person who has just written in is the likeliest visitor on the
            site to want another look at the work. */}
        <Link
          href="/work"
          style={{ "--reveal-delay": "560ms" } as React.CSSProperties}
          className="rise label mt-8 text-muted-foreground transition-colors duration-200 hoverable:hover:text-foreground"
        >
          See the work &rarr;
        </Link>
      </div>
    );
  }

  return (
    // `gap-6` and four rows of message: the form is a cell of the contact
    // strip now, and at 610px of strip on a 1280x700 laptop the eight-gap
    // version put the send button below the fold of its own box.
    <form
      action={formAction}
      /* Whether the form has what it needs, read off the form itself
         rather than tracked field by field: the inputs already say what
         they require, and `checkValidity` is the browser answering the
         same question. `noValidate` turns off the browser's own bubbles,
         not its validity model, so this keeps working.

         `input` and `change` both, because typing fires one and a radio
         or an autofill fires the other. */
      onInput={(e) => setReady(e.currentTarget.checkValidity())}
      onChange={(e) => setReady(e.currentTarget.checkValidity())}
      /* The gate. It used to be the `disabled` attribute on the button,
         which also took the button out of the tab order: a keyboard
         reached every field and then found nothing at the end of the
         form. The button stays a button now and says it is not ready
         (`aria-disabled`), and this refuses the submit — a press or Enter
         in a field alike — and puts the focus on the first field that is
         still empty, which is the answer to "what is missing". React
         skips the action when the event is prevented. */
      onSubmit={(e) => {
        if (e.currentTarget.checkValidity()) return;
        e.preventDefault();
        e.currentTarget.querySelector<HTMLElement>(":invalid")?.focus();
      }}
      className="flex flex-col gap-6"
      noValidate
    >
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
        error={state.errors?.email ?? emailHint}
        /* The one field whose emptiness is not the only way to be wrong.
           Said on leaving it, not while typing, and cleared on the next
           keystroke. */
        onBlur={(e) =>
          setEmailHint(
            e.currentTarget.value && !e.currentTarget.validity.valid
              ? "That does not look like an email address"
              : undefined,
          )
        }
        onInput={() => setEmailHint(undefined)}
        autoComplete="email"
        required
      />

      {/* Julian: options again, and still after the email. The chips say
          what the six are without being opened, which a dropdown cannot,
          and the answer changes the question under it — so seeing the
          choices is worth the two rows they take. What moved and stayed
          moved is the position: name, email, then this, rather than the
          form opening on the site's question before the visitor has
          written a word. */}
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
                /* Keyboard focus only. `focus-within` put the accent ring
                   around whichever kind of shoot had been pressed and left
                   it there, so a chosen type wore two outlines: its own
                   border and a teal one outside it. A clicked radio does
                   not match `:focus-visible` (measured), so this is the
                   ring for somebody arriving by Tab and nobody else.
                   Julian asked. */
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]",
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
          // `emerge`: it is a new node when a submit fails, so it fades in
          // instead of snapping into the column above the button.
          className={cn(
            "emerge border p-5 text-sm leading-relaxed",
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

      {/* Three things on one line is a desktop’s idea. At 768 it put the
          sentence about what is missing into a 47px column, one word to a
          line and 119px tall, and clipped the address by 30; at 390 the
          column was 54. Wrapping instead, and the sentence takes a line of
          its own below the button until there is a window wide enough to
          hold all three. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="submit"
          disabled={pending}
          aria-disabled={!ready || undefined}
          aria-describedby={!ready ? "enquire-missing" : undefined}
          className="label action px-6 py-4 press active:scale-[0.97] aria-disabled:active:scale-100"
        >
          {pending ? "Sending…" : "Inquire"}
        </button>
        {/* What is still missing, where the button is, and only once
            there is any reason to say it. */}
        {!ready && !pending ? (
          <p
            id="enquire-missing"
            className="label order-last basis-full text-muted-foreground lg:order-none lg:basis-auto"
          >
            Your name, your email and a line about the shoot
          </p>
        ) : null}
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
        rows={as === "textarea" ? 4 : undefined}
        aria-invalid={error ? true : undefined}
        // Points a screen reader at the message rather than only colouring
        // the border, which says nothing to anyone not looking at it.
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "mt-3 block w-full border-0 border-b bg-transparent py-3 text-base",
          "transition-colors duration-200 placeholder:text-muted-foreground/60",
          // Focus is the rule under the field coming up to full ink. No
          // accent ring as well: a text field shows focus whether the
          // click or the keyboard put it there, so the ring was on screen
          // every time somebody typed. Julian did not want it.
          "focus:outline-none focus-visible:outline-none focus:border-foreground",
          error ? "border-destructive" : "border-border",
        )}
        {...props}
      />

      {error ? (
        <p id={errorId} className="mt-2 text-xs text-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The mark that draws itself when an enquiry lands.
 *
 * A ring and a check, in the green this site reserves for state — `--live`
 * rather than the teal accent, on the same reasoning the token carries: the
 * accent is identity and belongs on things you can press, while this is a
 * report on something that just happened.
 *
 * The ring closes first and the check follows into it. That order reads as
 * *completing* something; both at once reads as two lines appearing. Each is
 * the one `jg-draw` keyframe taking that path's own `stroke-dashoffset` to
 * zero, and the lengths are written inline because they are facts about the
 * geometry rather than about the animation: 2*pi*r at r=15 is 94.25, and the
 * check's two segments measure about 22. Both are rounded *up* where they are
 * uncertain — a length a shade too long finishes a hair early, where one too
 * short leaves the line permanently unfinished.
 */
function SentMark() {
  return (
    <svg
      viewBox="0 0 36 36"
      aria-hidden
      className="size-14 text-live"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle
        cx="18"
        cy="18"
        r="15"
        className="draw"
        style={
          {
            strokeDasharray: 94.25,
            strokeDashoffset: 94.25,
            "--draw-dur": "560ms",
          } as React.CSSProperties
        }
      />
      <path
        d="M11.5 18.5 L16 23 L24.5 13.5"
        className="draw"
        style={
          {
            strokeDasharray: 22,
            strokeDashoffset: 22,
            "--draw-dur": "300ms",
            "--draw-delay": "340ms",
          } as React.CSSProperties
        }
      />
    </svg>
  );
}
