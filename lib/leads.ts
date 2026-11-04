import { sealer, type Sealer } from "./lead-crypto";

/* ── leads: one record per person ─────────────────────────────────
 * Julian (2026-11-03, PLAN-lead-desk.md): every inquiry, call and booking
 * in one list, with a stage on each person. Until now one person who
 * wrote, then booked a call, then paid was two or three unrelated rows.
 *
 * So beside the raw rows (`msg:`, still written first and kept as the
 * log) the INBOX namespace holds one `lead:<id>` per person, sealed with
 * LEADS_KEY (`lib/lead-crypto.ts`). Each event
 * that reaches the site (the form, a Cal.com booking, a deposit in
 * trouble) is folded into it here. KV is the source of truth; Notion is a
 * mirror of it, never the other way.
 *
 * Automatic events only move a lead forward: a second inquiry from a
 * client already Confirmed must not drop them back to Inquiry. A new
 * inquiry from someone Delivered or Lost opens them again. Julian moves
 * the rest by hand (Replied, Quoted, Shot, Delivered, Lost).
 *
 * The record's summary rides sealed in KV metadata, so the list costs one
 * request. Pure functions here; `recordLead` is the one place
 * that touches the binding, and it never throws: the raw row is already
 * stored, and a lead that failed to update must not fail the form.
 * ─────────────────────────────────────────────────────────────── */

export const STAGES = ["Inquiry", "Replied", "Call booked", "Quoted", "Confirmed", "Shot", "Delivered", "Lost"] as const;
export type Stage = (typeof STAGES)[number];

/** What happened, as it reached the site. `stage` is Julian's own move. */
export type LeadEvent = {
  at: string;
  kind: "inquiry" | "call" | "booking" | "no-deposit" | "deposit-stuck" | "stage" | "snooze" | "mail";
  /** The raw row (`msg:` key), Cal.com uid or Stripe intent, so a retry folds in once. */
  ref?: string;
  /** Booking time, session, new stage, a mail's subject: a short line for the timeline. */
  note?: string;
  /** Kind "mail": who it went to, which mail, and the booking it was about. */
  mail?: Sent;
};

/** A mail the site sent about this person: to them (book@), or about them to hello@. */
export type Sent = { to: "client" | "hello@"; kind: string; booking?: string };

/** Something on the lead that needs him, beyond its stage. */
export type Flag = "stuck" | "no-deposit";

export type Lead = {
  email: string;
  name: string;
  stage: Stage;
  /** When the stage last changed: the late check counts from here. */
  stageAt: string;
  firstAt: string;
  lastAt: string;
  /** Form type or Cal.com slug of the latest event that had one. */
  kind?: string;
  /** Next session or call, ISO. */
  when?: string;
  /** Stripe dashboard link of a deposit paid for this person. */
  deposit?: string;
  flags?: Flag[];
  snoozeUntil?: string;
  /** Notion page this lead is mirrored to. */
  notion?: string;
  /** Something new since he last opened it. */
  unread: boolean;
  events: LeadEvent[];
};

/** What the list shows, sealed into KV metadata (under its 1024-byte cap). `id` is added when listed. */
export type LeadSummary = Omit<Lead, "events" | "notion" | "deposit"> & { paid?: true; id?: string };

/** Events kept per lead: the timeline needs the recent ones, KV values stay small. */
const KEEP = 50;

/** A lead's KV key: its id (an HMAC of the address, `lib/lead-crypto.ts`), never the address. */
export const leadKey = (id: string) => `lead:${id}`;

const rank = (s: Stage) => STAGES.indexOf(s);
const closed = (s: Stage) => s === "Delivered" || s === "Lost";

/** The stage an automatic event asks for, or none. */
const asks: Partial<Record<LeadEvent["kind"], Stage>> = {
  inquiry: "Inquiry",
  call: "Call booked",
  booking: "Confirmed",
};

export type Change = {
  event: LeadEvent;
  name?: string;
  kind?: string;
  when?: string;
  deposit?: string;
  flag?: Flag;
  /** Julian's own stage move (kind "stage"): any direction. */
  stage?: Stage;
  /** Kind "snooze": ISO time, or "" to wake it. */
  snoozeUntil?: string;
};

/** One event folded into a lead. Returns the lead unchanged when the event
    was already folded in (a webhook retry carries the same ref). */
export function fold(lead: Lead | null, email: string, c: Change): Lead {
  const { event } = c;
  if (lead && event.ref && lead.events.some((e) => e.kind === event.kind && e.ref === event.ref)) return lead;

  const base: Lead = lead ?? {
    email: email.trim().toLowerCase(),
    name: c.name || email,
    stage: "Inquiry",
    stageAt: event.at,
    firstAt: event.at,
    lastAt: event.at,
    unread: true,
    events: [],
  };
  const next: Lead = { ...base, events: [...base.events, event].slice(-KEEP) };

  if (event.kind === "stage" && c.stage) {
    if (c.stage !== next.stage) Object.assign(next, { stage: c.stage, stageAt: event.at });
    // A stage he set clears what it answers.
    if (c.stage !== "Confirmed") next.flags = next.flags?.filter((f) => f !== "no-deposit");
    return tidy(next);
  }
  // A mail the site sent is a line on the timeline, not news.
  if (event.kind === "mail") return tidy(next);
  if (event.kind === "snooze") {
    next.snoozeUntil = c.snoozeUntil || undefined;
    // Unsnoozed by hand: back under Needs me.
    if (!c.snoozeUntil) next.unread = true;
    return tidy(next);
  }

  // Something arrived from outside: it is news.
  Object.assign(next, { lastAt: event.at, unread: true, snoozeUntil: undefined });
  if (c.name && (!lead || next.name === next.email)) next.name = c.name;
  if (c.kind) next.kind = c.kind;
  if (c.when) next.when = c.when;
  if (c.deposit) next.deposit = c.deposit;
  if (c.flag && !next.flags?.includes(c.flag)) next.flags = [...(next.flags ?? []), c.flag];

  const want = asks[event.kind];
  if (want && (rank(want) > rank(next.stage) || (want === "Inquiry" && closed(next.stage)) || !lead)) {
    Object.assign(next, { stage: want, stageAt: event.at });
  }
  return tidy(next);
}

const tidy = (l: Lead): Lead => {
  if (!l.flags?.length) delete l.flags;
  if (!l.snoozeUntil) delete l.snoozeUntil;
  return l;
};

/** Hours Julian promises to answer in; the site says "within a day". */
export const REPLY_HOURS = 24;
/** A quote with no answer this long is worth a nudge. */
export const QUOTE_DAYS = 5;

/** Whether a lead has waited past what was promised. Snoozed leads never are. */
export function isLate(l: Pick<Lead, "stage" | "stageAt" | "snoozeUntil">, now: number, replyHours = REPLY_HOURS): boolean {
  if (l.snoozeUntil && Date.parse(l.snoozeUntil) > now) return false;
  const waited = now - Date.parse(l.stageAt);
  if (l.stage === "Inquiry") return waited > replyHours * 3600e3;
  if (l.stage === "Quoted") return waited > QUOTE_DAYS * 864e5;
  return false;
}

// Name and email capped: KV metadata holds 1024 bytes, and the sealed summary
// grows by a third, so one long Cal.com name must not cost the whole lead.
export const leadSummary = ({ events: _e, notion: _n, deposit, ...rest }: Lead): LeadSummary => ({
  ...rest,
  name: rest.name?.slice(0, 80),
  email: rest.email.slice(0, 120),
  ...(deposit ? { paid: true as const } : {}),
});

type KV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put">;
/** Where leads live: the INBOX namespace, sealed with LEADS_KEY. */
export type LeadStore = { INBOX?: KV; LEADS_KEY?: string };

/** One lead, opened. Null when it is not there. */
export async function readLead(kv: KV, s: Sealer, id: string): Promise<Lead | null> {
  const raw = await kv.get(leadKey(id));
  return raw ? s.open<Lead>(raw) : null;
}

/** One lead, sealed, with its sealed summary as the metadata the list reads. */
export async function writeLead(kv: KV, s: Sealer, id: string, lead: Lead): Promise<void> {
  await kv.put(leadKey(id), await s.seal(lead), { metadata: { s: await s.seal(leadSummary(lead)) } });
}

/** Logs a mail the site sent against the person it was about. Never throws. */
export const logMail = (env: LeadStore, email: string | undefined, subject: string, mail: Sent) =>
  recordLead(env, email ?? "", { event: { at: new Date().toISOString(), kind: "mail", note: subject, mail } });

/**
 * Folds one event into the person's record and stores it, sealed. Without
 * LEADS_KEY nothing is recorded: never a lead in the clear.
 * shortcut: read, fold, write is not atomic, so two events for the same
 * person in the same second can lose one. Webhooks and the form for one
 * person are minutes apart; a Durable Object if that ever changes.
 */
export async function recordLead(env: LeadStore, email: string, c: Change): Promise<Lead | null> {
  const seal = sealer(env.LEADS_KEY);
  if (!env.INBOX || !email.includes("@")) return null;
  if (!seal) {
    console.error("lead", "LEADS_KEY unset or malformed, not recorded");
    return null;
  }
  try {
    const s = await seal;
    const id = await s.id(email);
    const before = await readLead(env.INBOX, s, id);
    const after = fold(before, email, c);
    if (after === before) return after;
    await writeLead(env.INBOX, s, id, after);
    return after;
  } catch (e) {
    console.error("lead", String(e));
    return null;
  }
}
