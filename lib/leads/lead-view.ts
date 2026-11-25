/**
 * What the lead page reads off one lead: contact handles, the one filled
 * button, the booking it can cancel and the money. No React and no DOM:
 * the page turns `primary.mail` into a link (Mail on iOS, Gmail elsewhere).
 */
import { callSheet, fillTemplate, mailable, TEMPLATES, type Template } from "@/lib/leads/lead-crm";
import { balance, depositOfLead, isSettled, subtotal } from "@/lib/leads/invoice";
import { dateTimeLabel, needsRenewal, nextStep } from "@/lib/leads/lead-desk";
import { isLate, NUDGES, quoteNudge, type Lead, type LeadEvent, type LeadSummary } from "@/lib/leads/leads";

/** A mail to write: to, subject, body. */
export type MailParts = [to: string, subject: string, body: string];

export type LeadView = {
  /** The record once loaded, else the list's summary of it. */
  l: Lead | LeadSummary;
  first: string;
  mailOk: boolean;
  ig?: string;
  phone?: string;
  late: boolean;
  step: string | null;
  /** Where the quote's follow-ups are, as `quoteNudge` says. */
  nudgeStep: ReturnType<typeof quoteNudge>;
  /** The one filled button: the nudge or renewal when one is due, the call sheet once booked with a plan. */
  primary: { label: string; win: string; mail: MailParts } | null;
  /** The booking the site made for them, while it stands; `booked` is its id. */
  bookedEvent?: LeadEvent;
  booked?: string;
  /** "Intro call on Nov 4, 3:00 PM", for the cancel and no-show prompts. */
  which: string;
  /** The booking is still to come. */
  ahead: boolean;
  invoiced?: number;
  /** What the open invoices still owe, else the quote less the deposit. */
  owed?: number;
  paidAt?: string;
};

/** The lead page's facts for `summary`, or `lead` once loaded, at `now`. */
export function leadView(lead: Lead | null, summary: LeadSummary, templates: Template[], now: number): LeadView {
  const l = lead ?? summary;
  const full = lead;
  const first = l.name.split(" ")[0];
  const mailOk = mailable(l.email);
  const ig = full?.ig ?? (l.email.startsWith("ig:") ? l.email.slice(3) : undefined);
  const phone = full?.phone ?? (l.email.startsWith("tel:") ? l.email.slice(4) : undefined);
  const late = isLate(l, now);
  const step = nextStep(l);
  const nudgeStep = quoteNudge(l, now);
  const nudge = templates.find((t) => t.id === `nudge${NUDGES.indexOf(nudgeStep as (typeof NUDGES)[number]) + 1}`);
  const renewTemplate = templates.find((x) => x.id === "renew") ?? TEMPLATES.find((x) => x.id === "renew")!;
  const sheet = full?.plan && l.when && l.stage === "Confirmed" ? callSheet(full) : null;
  const primary = !mailOk
    ? null
    : needsRenewal(l)
      ? {
          label: "Renew licence",
          win: "Keep the licence",
          mail: [l.email, fillTemplate(renewTemplate.subject, l), fillTemplate(renewTemplate.body, l)] as MailParts,
        }
      : nudge && late
        ? {
            label: `Send ${nudge.name}`,
            win: "Land the booking",
            mail: [l.email, fillTemplate(nudge.subject, l), fillTemplate(nudge.body, l)] as MailParts,
          }
        : sheet
          ? { label: "Send call sheet", win: "Set the day", mail: [sheet.to, sheet.subject, sheet.body] as MailParts }
          : null;

  // The latest booking only; a lead with two live bookings would need a picker.
  const bookedEvent = l.when
    ? [...(full?.events ?? [])].reverse().find((e) => (e.kind === "booking" || e.kind === "call") && e.ref)
    : undefined;
  const which = `${bookedEvent?.note ?? "the booking"} on ${l.when ? dateTimeLabel(l.when) : ""}`;
  const ahead = !!l.when && Date.parse(l.when) > now;

  // One invoice total per client, lines as needed. Once invoiced, the balance is what the open invoices still owe.
  const invoices = full?.invoices ?? [];
  const invoiced = invoices.length ? subtotal(invoices.flatMap((v) => v.lines)) : undefined;
  const owed = invoices.length
    ? invoices.filter((v) => !isSettled(v)).reduce((n, v) => n + balance(v), 0)
    : full?.quote !== undefined
      ? full.quote - (full.deposit ? depositOfLead(full) : 0)
      : undefined;
  const paidAt = full?.deposit ? full.events.find((e) => e.kind === "booking")?.at : undefined;

  return {
    l,
    first,
    mailOk,
    ig,
    phone,
    late,
    step,
    nudgeStep,
    primary,
    bookedEvent,
    booked: bookedEvent?.ref,
    which,
    ahead,
    invoiced,
    owed,
    paidAt,
  };
}
