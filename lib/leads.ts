import { sealer, type Sealer } from "./lead-crypto";
import { notify, pushFor } from "./lead-push";

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
  kind: "inquiry" | "call" | "booking" | "no-deposit" | "deposit-stuck" | "stage" | "snooze" | "mail" | "replied" | "wrote" | "archive" | "trash";
  /* "replied" / "wrote": mail between hello@ and them in Gmail, ref = the Gmail message id (`lib/gmail-sync.ts`). */
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
  /** Set aside by Julian: out of every list but Archived. A new message brings it back. */
  archivedAt?: string;
  /** In the trash: out of every list but Trash, until he recovers it or empties the trash. */
  trashedAt?: string;
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
  /** Kind "archive" / "trash": in (true) or back out (false). */
  on?: boolean;
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
  // His own reply from Gmail answers the inquiry: Replied, and off Needs me.
  if (event.kind === "replied") {
    if (next.stage === "Inquiry") Object.assign(next, { stage: "Replied", stageAt: event.at });
    return tidy({ ...next, unread: false });
  }
  if (event.kind === "snooze") {
    next.snoozeUntil = c.snoozeUntil || undefined;
    // Unsnoozed by hand: back under Needs me.
    if (!c.snoozeUntil) next.unread = true;
    return tidy(next);
  }

  if (event.kind === "archive") return tidy({ ...next, archivedAt: c.on ? event.at : undefined });
  if (event.kind === "trash") return tidy({ ...next, trashedAt: c.on ? event.at : undefined });

  // Something arrived from outside: it is news, and out of Archived. The
  // trash keeps it: what he threw out (spam, mostly) stays there.
  Object.assign(next, { lastAt: event.at, unread: true, snoozeUntil: undefined, archivedAt: undefined });
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
  if (!l.archivedAt) delete l.archivedAt;
  if (!l.trashedAt) delete l.trashedAt;
  return l;
};

/** Julian: "yes, empty trash after 30 days". Days a lead keeps in the trash. */
export const TRASH_DAYS = 30;
/** Whole days before a trashed lead is deleted for good; 0 or less means due. */
export const trashDaysLeft = (trashedAt: string, now: number) => Math.ceil((Date.parse(trashedAt) + TRASH_DAYS * 864e5 - now) / 864e5);

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

type KV = Pick<NonNullable<CloudflareEnv["INBOX"]>, "get" | "put" | "list" | "delete">;
/** Where leads live: the INBOX namespace, sealed with LEADS_KEY. */
export type LeadStore = { INBOX?: KV; LEADS_KEY?: string; VAPID_KEY?: string };

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
 * Work that may run after the response: a push service can take seconds,
 * and the form, Cal.com and Stripe all wait on recordLead. In the Worker it
 * goes to waitUntil; with no request around it (tests, scripts) it runs
 * inline. Imported lazily so the desk's client bundle never loads it.
 */
async function later(p: Promise<void>) {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    getCloudflareContext().ctx.waitUntil(p);
  } catch {
    await p;
  }
}

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
    // Something reached the site: ping his devices (`lib/lead-push.ts`).
    const push = pushFor(after, c.event);
    if (push && env.VAPID_KEY) await later(notify(env.INBOX, env.VAPID_KEY, push));
    return after;
  } catch (e) {
    console.error("lead", String(e));
    return null;
  }
}

/* ── the Inbox, backfilled ────────────────────────────────────────
 * Julian (2026-11-04): "add the stuff i have in my juliangigola admin inbox
 * to my leads". The `msg:` rows from before the desk, folded into leads at
 * their own times. Nothing is mailed, Notion is not touched, no row deleted.
 * ─────────────────────────────────────────────────────────────── */

/** One Inbox row as its KV key plus the summary its metadata carries. */
export type InboxRow = { key: string; at: string; type: string; name: string; email: string; read: boolean; detail?: string };

/** What an old row was: the form, a call, a booking, or a deposit gone wrong. */
export function rowEvent(r: InboxRow): Change {
  const booked = r.type === "booking";
  const kind: LeadEvent["kind"] = !booked
    ? "inquiry"
    : r.detail?.startsWith("Deposit paid, not booked")
      ? "deposit-stuck"
      : /\bcall\b/i.test(r.detail ?? "")
        ? "call"
        : "booking";
  return { event: { at: r.at, kind, ref: r.key, note: booked ? r.detail : r.type }, name: r.name, ...(booked ? {} : { kind: r.type }) };
}

const ARRIVED: LeadEvent["kind"][] = ["inquiry", "call", "booking", "deposit-stuck"];

/**
 * A person's old rows folded into their lead, or null when every row is
 * already there (run twice, changes nothing). Already there: the same row
 * (`ref`), or something that arrived within two minutes of it, which is
 * the same booking recorded live under its Cal.com uid.
 * A new lead is built in time order and is unread only if a row was;
 * one whose rows were all read, still at Inquiry, lands at Replied.
 * An existing lead only gains the events and an earlier First seen: its
 * stage, snooze and unread are Julian's and stay.
 */
export function backfillLead(lead: Lead | null, email: string, rows: InboxRow[]): Lead | null {
  const sorted = [...rows].sort((a, b) => a.at.localeCompare(b.at));
  const near = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) < 120e3;
  const add = sorted
    .map(rowEvent)
    .filter(({ event }) => !lead?.events.some((x) => x.ref === event.ref || (ARRIVED.includes(x.kind) && near(x.at, event.at))));
  if (!add.length) return null;
  if (!lead) {
    let built: Lead | null = null;
    for (const c of add) built = fold(built, email, c);
    const unread = sorted.some((r) => !r.read);
    // Julian: "import read ones as replied". All read means he dealt with it.
    return { ...built!, unread, ...(!unread && built!.stage === "Inquiry" ? { stage: "Replied" as const } : {}) };
  }
  const events = [...lead.events, ...add.map((c) => c.event)].sort((a, b) => a.at.localeCompare(b.at)).slice(-KEEP);
  return { ...lead, events, firstAt: add[0].event.at < lead.firstAt ? add[0].event.at : lead.firstAt };
}
