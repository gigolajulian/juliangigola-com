"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { submitEnquiry, type ContactState } from "@/app/contact/actions";
import { RESPONSE_TIME } from "@/lib/site";
import { cn } from "@/lib/utils";
import StatusMark from "@/components/StatusMark";
import { Orb, ORB_ROUND } from "@/components/orb";
import { ReferencePicks } from "@/components/reference-picks";
import { trailContext } from "@/components/visit-trail";

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
  { value: "event", label: "Event" },
  { value: "other", label: "Other" },
] as const;

/** What to ask second, given the first answer. */
const FOLLOW_UP: Record<string, { label: string; placeholder: string }> = {
  editorial: {
    label: "Publication and issue date",
    placeholder: "e.g. print, due Feb 14",
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
  event: {
    label: "The event",
    placeholder: "venue, how many people, what matters most",
  },
  other: {
    label: "What it is",
    placeholder: "where and roughly when",
  },
};

/* Julian (2026-10-14): one or two taps that answer what he would ask
   first, per kind of shoot, in place of typing it. Optional; the answers
   go in as the inquiry's details ("Date: 2026-11-08 · Coverage: 4 hours"). */
type Ask = { label: string; date?: true; options?: string[]; many?: true };
/* With the taps above it, the message asks what they don't. */
const REST: Record<string, string> = {
  event: "What it is and where, how many people",
  music: "The artist and the release",
  campaign: "The brand, the brief, the territory",
  wedding: "Where, and what matters most to you",
};
const ASKS: Record<string, Ask[]> = {
  event: [{ label: "Date", date: true }, { label: "Coverage", options: ["2 hours", "4 hours", "Full day"] }],
  music: [{ label: "Release date", date: true }, { label: "For", options: ["Press", "Cover", "Video"], many: true }],
  campaign: [{ label: "Runs on", options: ["Social", "Web", "Print", "Out of home"], many: true }, { label: "Deadline", date: true }],
  wedding: [{ label: "Date", date: true }, { label: "Guests", options: ["Under 50", "50 to 150", "Over 150"] }],
};

function Asks({ asks, onChange }: { asks: Ask[]; onChange: (detail: string) => void }) {
  const [got, setGot] = React.useState<Record<string, string[]>>({});
  const set = (label: string, v: string[]) => {
    const next = { ...got, [label]: v };
    setGot(next);
    onChange(asks.filter((a) => next[a.label]?.length).map((a) => `${a.label}: ${next[a.label].join(", ")}`).join(" · "));
  };
  return (
    <div className="flex flex-col gap-3.5 sm:gap-[clamp(0.75rem,2.4vh,1.25rem)]">
      {asks.map((a) =>
        a.date ? (
          <label key={a.label} className="label flex items-center justify-between gap-4 text-muted-foreground">
            {a.label}
            <input
              type="date"
              value={got[a.label]?.[0] ?? ""}
              onChange={(e) => set(a.label, e.target.value ? [e.target.value] : [])}
              className="border-0 border-b border-border bg-transparent py-1.5 text-base text-foreground [color-scheme:inherit] focus:border-foreground/40 focus:outline-none"
            />
          </label>
        ) : (
          <fieldset key={a.label} className="flex flex-wrap items-center gap-2">
            <legend className="label float-left mr-2 text-muted-foreground">{a.label}</legend>
            {a.options!.map((o) => {
              const on = got[a.label]?.includes(o) ?? false;
              return (
                <label
                  key={o}
                  /* Julian: the pointer sticks to the options a little
                     (`pointer-mark.tsx`); the word grows less than an icon. */
                  data-stick="fill"
                  className={cn(
                    "[&[data-stuck]>span]:!scale-[1.06] label cursor-pointer border px-3 py-1.5 transition-colors duration-200 [@media(pointer:coarse)]:py-2.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]",
                    // Julian: a picked option in the site's teal.
                    on ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted-foreground hoverable:hover:border-foreground/40 hoverable:hover:text-foreground",
                  )}
                >
                  <input
                    type={a.many ? "checkbox" : "radio"}
                    checked={on}
                    onChange={() => set(a.label, a.many ? (on ? got[a.label].filter((x) => x !== o) : [...(got[a.label] ?? []), o]) : on ? [] : [o])}
                    className="sr-only"
                  />
                  <span className="inline-block">{o}</span>
                </label>
              );
            })}
          </fieldset>
        ),
      )}
    </div>
  );
}

const INITIAL: ContactState = { status: "idle" };

/* The request itself failing (offline, a dropped connection, the Worker
   erroring) threw out of the action and took the whole page to its error
   screen, the brief gone with it. Caught here instead: the fields come
   back as typed, and the mail app is offered, as when nothing could be
   stored (`app/contact/actions.ts`). */
async function submitOrKeep(prev: ContactState, data: FormData): Promise<ContactState> {
  try {
    return await submitEnquiry(prev, data);
  } catch {
    const read = (key: string) => String(data.get(key) ?? "").trim();
    const values = {
      type: read("type"),
      name: read("name"),
      email: read("email"),
      detail: [read("session"), read("detail")].filter(Boolean).join(" · "),
      message: read("message"),
    };
    const body = [
      values.type ? `Type: ${values.type}` : null,
      values.detail ? `Details: ${values.detail}` : null,
      `From: ${values.name} <${values.email}>`,
      "",
      values.message,
    ]
      .filter((line) => line !== null)
      .join("\n");
    return {
      status: "error",
      values,
      message:
        "That didn't go through, so nothing was sent. Your message is still here. Try again, or open it in your mail app and it will reach me directly.",
      mailto: `mailto:hello@juliangigola.com?subject=${encodeURIComponent(`${values.type || "other"} inquiry from ${values.name}`)}&body=${encodeURIComponent(body)}`,
    };
  }
}

/** The contact screen's head, or the booking one when the link came
    from a session (`?type=session`). */
export function WhenBooking({
  booking,
  children,
}: {
  booking: React.ReactNode;
  children: React.ReactNode;
}) {
  return useSearchParams().get("type") === "session" ? booking : children;
}

export function ContactForm({
  defaults,
  sessions = [],
}: {
  /** What a page that holds its own form is about: a booking page's
      session or kind of shoot, used when the address names none. */
  defaults?: { type?: string; session?: string };
  /** The names on the Sessions screen, offered in place of the kinds of
      shoot once the visitor came to book one. */
  sessions?: string[];
} = {}) {
  const params = useSearchParams();

  // /sessions links here with the type pre-chosen, so someone who has already
  // said what they want is not asked again.
  const preset = params.get("type") ?? defaults?.type ?? null;
  const presetSession = params.get("session") ?? defaults?.session ?? null;
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
    /* Nothing picked until the visitor picks: a private client from
       the nav landed on Editorial. Unpicked, the second question is
       the general one and the server files it as Other. */
    TYPES.some((t) => t.value === preset) ? (preset as string) : "",
  );
  /* And again when the link changes under a form already on the
     page. The form lives on the homepage, so it is mounted long
     before a session's Inquire is pressed: Graduation landed here on
     Editorial, asking for a publication and an issue date. */
  const [seen, setSeen] = React.useState(preset);
  if (preset !== seen) {
    setSeen(preset);
    if (TYPES.some((t) => t.value === preset)) setType(preset as string);
  }
  /* Book a session landed on the commission desk, the session pushed
     into the date field. Booking asks which session, then when and
     where. */
  const booking = type === "session" && sessions.length > 0;
  const [session, setSession] = React.useState(presetSession ?? "");
  const [seenSession, setSeenSession] = React.useState(presetSession);
  if (presetSession !== seenSession) {
    setSeenSession(presetSession);
    setSession(presetSession ?? "");
  }
  /* Sessions are booked from Book a session, so the commission desk does
     not offer one; a link that names it (`?type=session`) still lands. */
  const choices = booking
    ? sessions.map((s) => ({ value: s, label: s }))
    : TYPES.filter((t) => t.value !== "session" || type === "session");
  const chosen = booking ? session : type;
  const choose = booking ? setSession : setType;
  /* Julian (2026-10-14): on a page that is about one kind of shoot (a
     commission's card, a booking page's form) it is not asked again; the
     answer goes in unseen. */
  const fixed = !!defaults?.type && (defaults.type !== "session" || !!defaults.session);
  const kind = booking ? (/wedding/i.test(session) ? "wedding" : "") : type;
  const [answers, setAnswers] = React.useState("");
  const [state, formAction, pending] = React.useActionState(
    submitOrKeep,
    INITIAL,
  );

  const followUp = booking
    ? { label: "When, where and how many of you", placeholder: "e.g. May 17, SJSU, two of us" }
    : FOLLOW_UP[type] ?? FOLLOW_UP.other;
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
        data-sent
        className="flex flex-col items-center self-start border border-border px-8 py-12 text-center sm:px-12"
      >
        <SentStatus />

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
          href="/portfolio"
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
         still empty, which is the answer to "what is missing".

         Sent from here rather than by `action`: React resets a form after
         its action, and the reset put the kind of shoot back to the first
         option while the state still held the chosen one (QA, a failed
         send, 2026-10-15). `action` stays for before the page hydrates. */
      onSubmit={(e) => {
        e.preventDefault();
        // Where they came from and what they read (`visit-trail.tsx`).
        const ctx = e.currentTarget.elements.namedItem("context");
        if (ctx instanceof HTMLInputElement) ctx.value = trailContext();
        if (!e.currentTarget.checkValidity()) {
          e.currentTarget.querySelector<HTMLElement>(":invalid")?.focus();
          return;
        }
        const data = new FormData(e.currentTarget);
        React.startTransition(() => formAction(data));
      }}
      /* Julian: on a phone the whole card fits a screen, so tighter there. */
      className="flex flex-col gap-3.5 sm:gap-[clamp(0.75rem,2.4vh,1.25rem)]"
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
      <input type="hidden" name="context" />
      {/* One box to the page; side by side where the window is short and
          wide (`contact-pair`, `globals.css`). */}
      <div className="contact-pair">
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
      </div>

      {/* Julian: options again, and still after the email. The chips say
          what the six are without being opened, which a dropdown cannot,
          and the answer changes the question under it — so seeing the
          choices is worth the two rows they take. What moved and stayed
          moved is the position: name, email, then this, rather than the
          form opening on the site's question before the visitor has
          written a word. */}
      {/* Julian: a dropdown on a phone, where the six chips took two rows
          and a third of the screen. It only sets the choice; the chips stay
          in the form (hidden) and carry the value, so there is one answer. */}
      {fixed ? (
        <input type="hidden" name={booking ? "session" : "type"} value={chosen} />
      ) : (
      <>
      <div className="sm:hidden">
        <label htmlFor="field-type" className="label block text-muted-foreground">
          {booking ? "Which session?" : "What kind of shoot?"}
        </label>
        <div className="relative mt-1">
          <select
            id="field-type"
            value={chosen}
            onChange={(e) => choose(e.target.value)}
            className="block w-full appearance-none rounded-none border-0 border-b border-border bg-transparent py-2 pr-8 text-base uppercase transition-colors duration-200 focus:border-foreground/40 focus:outline-none"
          >
            {!chosen ? <option value="">Choose one</option> : null}
            {choices.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <svg
            aria-hidden
            viewBox="0 0 12 12"
            className="pointer-events-none absolute right-1 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M2 4.5 6 8.5 10 4.5" />
          </svg>
        </div>
      </div>

      <fieldset className="max-sm:hidden">
        <legend className="label text-muted-foreground">
          {booking ? "Which session?" : "What kind of shoot?"}
        </legend>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {choices.map((t) => (
            <label
              key={t.value}
              data-stick="fill"
              className={cn(
                "[&[data-stuck]>span]:!scale-[1.06] label cursor-pointer border px-4 py-2 transition-colors duration-200 [@media(pointer:coarse)]:py-3",
                /* Keyboard focus only. `focus-within` put the accent ring
                   around whichever kind of shoot had been pressed and left
                   it there, so a chosen type wore two outlines: its own
                   border and a teal one outside it. A clicked radio does
                   not match `:focus-visible` (measured), so this is the
                   ring for somebody arriving by Tab and nobody else.
                   Julian asked. */
                "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)]",
                /* Chosen, in the site's teal (Julian, 2026-10-14). */
                chosen === t.value
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hoverable:hover:border-foreground/40 hoverable:hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name={booking ? "session" : "type"}
                value={t.value}
                checked={chosen === t.value}
                onChange={() => choose(t.value)}
                // Visually hidden rather than `hidden`, so it stays in the
                // tab order and arrow keys still walk the radio group.
                className="sr-only"
              />
              <span className="inline-block">{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      </>
      )}
      {booking ? <input type="hidden" name="type" value="session" /> : null}

      {/* Julian (2026-10-14): a simpler, shorter form. The follow-up
          question is the message's placeholder now, not a field of its
          own; what it was filled with from a link still goes in. */}
      {ASKS[kind] ? <Asks key={kind} asks={ASKS[kind]} onChange={setAnswers} /> : null}

      {values.detail || presetRef || answers || (presetSession && type === "session" && !booking) ? (
        <input
          type="hidden"
          name="detail"
          value={values.detail || [presetRef ? `Similar to ${presetRef}` : type === "session" && !booking ? presetSession : "", answers].filter(Boolean).join(" · ")}
        />
      ) : null}

      <Field
        name="message"
        label={booking ? "Anything I should know" : "About the project"}
        as="textarea"
        placeholder={REST[kind] ?? `${followUp.label}, ${followUp.placeholder}`}
        defaultValue={values.message}
        error={state.errors?.message}
        required
      />

      <ReferencePicks resync={state} />

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
      {/* The address on the left, the button on the right, the sentence off
          the screen (still read out with the button). */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 lying:justify-end">
        <button
          type="submit"
          data-dial="send"
          disabled={pending}
          aria-disabled={!ready || undefined}
          aria-describedby={!ready ? "enquire-missing" : undefined}
          className="label action px-6 py-3 press active:scale-[0.97] aria-disabled:active:scale-100 sm:py-4 lying:!px-5 lying:!py-2"
        >
          {/* Julian: no orb on the button. StatusMark's cross if it could
              not send. Hidden from screen readers; the words say it. */}
          <span className="inline-flex items-center gap-2.5">
            {state.status === "error" && !pending ? (
              <span aria-hidden className="inline-flex">
                <StatusMark status="failed" size={14} errorColor="var(--destructive)" />
              </span>
            ) : null}
            {pending ? "Sending…" : booking ? "Book a session" : "Inquire"}
          </span>
        </button>
        {/* What is still missing, where the button is, and only once
            there is any reason to say it. */}
        {!ready && !pending ? (
          <p
            id="enquire-missing"
            className="sr-only"
          >
            Your name, your email and a line about the shoot
          </p>
        ) : null}
        {/* The address is above the form on a phone already. */}
        {/* In the labels' face, as References beside it (Julian, 2026-10-14). */}
        <p className="label order-first text-left text-muted-foreground max-sm:hidden lying:hidden">
          Email{" "}
          <a
            href="mailto:hello@juliangigola.com"
            data-ring="Email"
            className="underline decoration-border underline-offset-4 transition-colors duration-200 hoverable:hover:text-foreground"
          >
            hello@juliangigola.com
          </a>
        </p>
      </div>
    </form>
  );
}

/** A textarea as tall as what is in it; `max-h` stops it at three lines. */
const fit = (el: HTMLTextAreaElement | HTMLInputElement | null) => {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
};

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
    // Lifts toward you under the pointer and while it is being typed in
    // (`.contact-field`, globals.css).
    <div className="contact-field">
      <label htmlFor={id} className="label block text-muted-foreground">
        {label}
        {/* Said, not only shown: the faint "Optional" placeholder is
            a look, so the label carries the fact. */}
        {props.required ? <span aria-hidden> *</span> : <span className="sr-only">, optional</span>}
      </label>

      <Element
        id={id}
        name={name}
        /* Julian (2026-10-15): the brief starts as one line, on its rule,
           and grows as it is typed, up to three lines; past that it
           scrolls. Sized here rather than by `field-sizing`, which Safari
           lacks. */
        rows={as === "textarea" ? 1 : undefined}
        ref={as === "textarea" ? fit : undefined}
        onInput={as === "textarea" ? (e: { currentTarget: HTMLTextAreaElement | HTMLInputElement }) => fit(e.currentTarget) : undefined}
        aria-invalid={error ? true : undefined}
        // Points a screen reader at the message rather than only colouring
        // the border, which says nothing to anyone not looking at it.
        aria-describedby={error ? errorId : undefined}
        className={cn(
          "block w-full border-0 border-b bg-transparent pb-2 text-base sm:pb-2.5",
          /* Three lines at most, the padding and the rule on top. Its top
             padding is margin instead: scrolled, the text ran up into the
             padding under the label and a fourth line showed (iPhone, QA
             2026-10-15). Same place at rest. */
          as === "textarea"
            ? "mt-3 resize-none overflow-y-auto max-h-[calc(3lh+0.5rem+1px)] sm:mt-[1.125rem] sm:max-h-[calc(3lh+0.625rem+1px)]"
            : "mt-1 pt-2 sm:mt-2 sm:pt-2.5",
          // Placeholders fainter.
          "transition-colors duration-200 placeholder:text-muted-foreground/35",
          // Focus is the rule under the field darkening, to 40% ink. No
          // accent ring as well: a text field shows focus whether the click
          // or the keyboard put it there, so the ring was on screen every
          // time somebody typed. Julian did not want it.
          "focus:outline-none focus-visible:outline-none focus:border-foreground/40",
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

/* The sent card's mark: it arrives as the orb the button left, still
   composing, and closes on StatusMark's check in the site's green. */
function SentStatus() {
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    // One round of the orb before the check (Julian, 2026-10-14).
    const t = window.setTimeout(() => setDone(true), ORB_ROUND.composing);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <span aria-hidden className="inline-flex size-16 items-center justify-center">
      {done ? (
        <StatusMark
          status="done"
          size={56}
          strokeWidth={1}
          doneColor="var(--live)"
          drawDuration={320}
        />
      ) : (
        <Orb state="composing" size={64} />
      )}
    </span>
  );
}
